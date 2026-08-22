import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/jobs/domain/job.dart';
import 'package:mobile/features/jobs/domain/job_presentation.dart';

void main() {
  group('JobPresentation State Derivation', () {
    test('identifies pending offer', () {
      final job = Job(
        id: 1,
        requestId: 'REQ-001',
        status: 'assigned',
        isOffer: true,
        isAcceptedByCurrentEmployee: false,
        isAssignedToCurrentEmployee: false,
        canCancel: false,
      );

      final presentation = buildJobPresentation(job, hasActiveJob: false);

      expect(presentation.state, equals(JobPresentationState.offered));
      expect(presentation.isOffer, isTrue);
      expect(presentation.isAccepted, isFalse);
    });

    test('identifies accepted job for current employee', () {
      final job = Job(
        id: 2,
        requestId: 'REQ-002',
        status: 'accepted',
        isOffer: false,
        isAcceptedByCurrentEmployee: true,
        isAssignedToCurrentEmployee: true,
        canCancel: true,
      );

      final presentation = buildJobPresentation(job, hasActiveJob: false);

      expect(presentation.state, equals(JobPresentationState.accepted));
      expect(presentation.isOffer, isFalse);
      expect(presentation.isAccepted, isTrue);
    });

    test('identifies arrived job for current employee', () {
      final job = Job(
        id: 3,
        requestId: 'REQ-003',
        status: 'arrived',
        isOffer: false,
        isAcceptedByCurrentEmployee: true,
        isAssignedToCurrentEmployee: true,
        canCancel: false,
      );

      final presentation = buildJobPresentation(job, hasActiveJob: true);

      expect(presentation.state, equals(JobPresentationState.arrived));
      expect(presentation.isAccepted, isTrue);
    });

    test('identifies in_progress job', () {
      final job = Job(
        id: 4,
        requestId: 'REQ-004',
        status: 'in_progress',
        isOffer: false,
        isAcceptedByCurrentEmployee: true,
        isAssignedToCurrentEmployee: true,
        canCancel: false,
      );

      final presentation = buildJobPresentation(job, hasActiveJob: true);

      expect(presentation.state, equals(JobPresentationState.inProgress));
      expect(presentation.isAccepted, isTrue);
    });

    test('identifies completed job', () {
      final job = Job(
        id: 5,
        requestId: 'REQ-005',
        status: 'completed',
        isOffer: false,
        isAcceptedByCurrentEmployee: true,
        isAssignedToCurrentEmployee: true,
        canCancel: false,
      );

      final presentation = buildJobPresentation(job, hasActiveJob: false);

      expect(presentation.state, equals(JobPresentationState.completed));
      expect(presentation.isAccepted, isFalse);
    });
  });
}
