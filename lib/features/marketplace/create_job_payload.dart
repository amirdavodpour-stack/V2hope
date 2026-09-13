import 'create_job_validator.dart';

class CreateJobPayloadInput {
  const CreateJobPayloadInput({
    required this.title,
    required this.description,
    required this.categoryId,
    required this.minBudget,
    required this.maxBudget,
    required this.duration,
    required this.acceptanceCriteria,
    required this.city,
    required this.kind,
    required this.visibility,
    required this.schedule,
    required this.monthlySalary,
    required this.applicationDeadline,
  });
  final String title;
  final String description;
  final String categoryId;
  final String minBudget;
  final String maxBudget;
  final String duration;
  final String acceptanceCriteria;
  final String city;
  final String kind;
  final String visibility;
  final String schedule;
  final String monthlySalary;
  final String applicationDeadline;
}

Map<String, dynamic> buildCreateOpportunityPayload(
    CreateJobPayloadInput input) {
  return {
    'title': input.title.trim(),
    'description': input.description.trim(),
    'categoryId': input.categoryId,
    'jobType': input.kind == 'MISSION' ? 'FIXED' : 'HOURLY',
    'budgetType': 'FIXED',
    'budgetMin': double.parse(input.minBudget.trim()),
    'budgetMax': double.parse(input.maxBudget.trim()),
    'duration': input.kind == 'JOB' ? 30 : int.parse(input.duration.trim()),
    'acceptanceCriteria': input.acceptanceCriteria.trim(),
    'city': input.city.trim(),
    'kind': input.kind,
    'visibility': input.visibility,
    'schedule': input.kind == 'JOB' ? input.schedule : null,
    'monthlySalary':
        input.kind == 'JOB' ? double.parse(input.monthlySalary.trim()) : null,
    'applicationDeadline':
        input.kind == 'JOB' ? input.applicationDeadline.trim() : null,
  };
}

CreateJobValidationResult validateCreateOpportunity({
  required CreateJobPayloadInput input,
  required String defaultAcceptanceCriteria,
}) {
  return validateCreateJob(
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    minBudget: input.minBudget,
    maxBudget: input.maxBudget,
    duration: input.kind == 'JOB' ? '30' : input.duration,
    acceptanceCriteria: input.acceptanceCriteria.trim().isEmpty
        ? defaultAcceptanceCriteria
        : input.acceptanceCriteria,
  );
}
