import '../../core/transactions/payment.dart';
import '../../core/transactions/transaction_repository.dart';
import '../../core/application/use_cases.dart';

class TransactionController {
  TransactionController({required this.repository, required this.jobId});
  final TransactionRepository repository;
  final String jobId;
  late final LoadTransactionUseCase _loadUseCase = LoadTransactionUseCase(repository);
  late final TransactionCommandUseCase _commandUseCase = TransactionCommandUseCase(repository);
  late final String _fundIdempotencyKey = 'mobile-fund:$jobId';

  Future<HopePayment?> load() => _loadUseCase(jobId);

  Future<HopePayment> execute(String operation) => _commandUseCase(
        jobId, operation, idempotencyKey: operation == 'fund' ? _fundIdempotencyKey : null);
}
