import 'dart:async';
import 'dart:io';
import '../network/api_client.dart';

class PendingUpload {
  PendingUpload(
      {required this.jobId, required this.path, required this.filePath});
  final String jobId;
  final String path;
  final String filePath;
}

/// MVP upload queue with bounded retry/backoff. The queue is intentionally
/// in-memory; a durable local queue can replace this implementation later.
class UploadQueue {
  UploadQueue(this.api, {
    this.maxAttempts = 3,
    this.onPermanentFailure,
    this.onTransientFailure,
  }) {
    if (maxAttempts <= 0) {
      throw ArgumentError.value(
          maxAttempts, 'maxAttempts', 'must be greater than zero');
    }
  }
  final ApiClient api;
  final int maxAttempts;
  // Called when an item is dropped after a deterministic 4xx failure (see
  // drain() below), so the caller can surface it instead of it silently
  // vanishing from the queue.
  final void Function(PendingUpload item, Object error)? onPermanentFailure;
  /// Called when a non-permanent failure leaves the item queued for retry.
  final void Function(PendingUpload item, Object error)? onTransientFailure;
  final List<PendingUpload> _queue = [];
  bool _running = false;

  int get pendingCount => _queue.length;

  /// Uploads [file] to [path] immediately, retrying with backoff up to
  /// [maxAttempts] times, and returns the decoded response on success.
  /// Use this when the caller needs the response synchronously (e.g. to
  /// read back a storage key) instead of firing-and-forgetting via
  /// [enqueue]. Throws the last error if every attempt fails.
  Future<dynamic> uploadNowWithRetry(String path, File file) async {
    Object? lastError;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await api.uploadFile(path, file);
      } catch (e) {
        lastError = e;
        // Deterministic 4xx (bad file type, validation error, etc.) will
        // never succeed on retry. Real backend errors carry a semantic
        // `code` (e.g. FILE_TOO_LARGE), never "HTTP_<status>", so this must
        // check the actual HTTP status on the exception, not try to parse
        // one out of `code`.
        if (e is ApiException &&
            e.status != null &&
            e.status! >= 400 &&
            e.status! < 500) {
          break;
        }
        if (attempt < maxAttempts) {
          await Future<void>.delayed(Duration(milliseconds: 500 * attempt));
        }
      }
    }
    throw lastError!;
  }

  Future<void> enqueue(PendingUpload item) async {
    _queue.add(item);
    await drain();
  }

  Future<void> drain() async {
    if (_running) return;
    _running = true;
    try {
      while (_queue.isNotEmpty) {
        final item = _queue.first;
        final file = File(item.filePath);
        if (!await file.exists()) {
          _queue.removeAt(0);
          onPermanentFailure?.call(
            item,
            FileSystemException('Upload file no longer exists', item.filePath),
          );
          continue;
        }

        try {
          await uploadNowWithRetry(item.path, file);
          _queue.removeAt(0);
        } on ApiException catch (e) {
          // A deterministic 4xx (bad file type, validation error, etc.) will
          // never succeed on retry, so leaving it at the head would jam every
          // upload enqueued after it forever. Drop it and keep the queue
          // moving; surface the failure to the caller instead of the item
          // just silently disappearing.
          if (e.status != null && e.status! >= 400 && e.status! < 500) {
            _queue.removeAt(0);
            onPermanentFailure?.call(item, e);
            continue;
          }
          // Transient failure (network/timeout/5xx): keep it at the head and
          // stop this pass. A later enqueue()/drain() call retries it.
          onTransientFailure?.call(item, e);
          break;
        } catch (error) {
          // Preserve the failed item for a later explicit drain/retry, but
          // surface the stall so production wiring can record/report it.
          onTransientFailure?.call(item, error);
          break;
        }
      }
    } finally {
      _running = false;
    }
  }
}
