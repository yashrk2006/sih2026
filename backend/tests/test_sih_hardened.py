from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.users.models import Role, AccessPermission
from apps.cases.models import Case
from apps.documents.models import Document, DocumentType, DocumentStatus
from apps.assets.models import Asset, AssetType, AssetStatus, AssetCondition
from apps.audit.models import AuditEvent
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()


class SihHardenedTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="admin_sih", email="admin_sih@test.com", password="SecurePass123!", role=Role.ADMIN
        )
        self.investigator = User.objects.create_user(
            username="inv_sih", email="inv_sih@test.com", password="SecurePass123!", role=Role.INVESTIGATOR
        )
        self.legal = User.objects.create_user(
            username="legal_sih", email="legal_sih@test.com", password="SecurePass123!", role=Role.LEGAL_OFFICER
        )
        self.client.force_authenticate(user=self.admin)

        # Create a test case
        self.case = Case.objects.create(
            case_id="CASE-TEST-001",
            title="Sih Test Case",
            created_by=self.admin,
        )
        self.case.assigned_investigators.add(self.investigator)

        # Create a test document
        self.doc = Document.objects.create(
            filename="evidence.pdf",
            original_filename="evidence.pdf",
            document_type=DocumentType.EVIDENCE_RECORD,
            mime_type="application/pdf",
            file_size=1024,
            storage_location="test/evidence.pdf.enc",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            uploaded_by=self.investigator,
            case=self.case,
            status=DocumentStatus.ACTIVE,
        )

    def test_legal_hold_deletion_protection(self):
        """
        Verify that documents under legal hold CANNOT be deleted.
        """
        self.doc.legal_hold_status = True
        self.doc.save()

        # Try to delete at model level — should raise PermissionError
        with self.assertRaises(PermissionError) as context:
            self.doc.delete()
        
        self.assertIn("under legal hold", str(context.exception))

        # Turn hold status off and verify deletion works
        self.doc.legal_hold_status = False
        self.doc.save()
        self.doc.delete()
        
        with self.assertRaises(Document.DoesNotExist):
            Document.objects.get(filename="evidence.pdf")

    def test_case_sharing_collaboration(self):
        """
        Verify Case sharing, creator check, access checks, revoking access, and RBAC enforcement.
        """
        # 1. Investigator inv_sih is already assigned, let's share with legal_sih
        response = self.client.post(
            f"/api/cases/{self.case.case_id}/share/",
            {"username": "legal_sih", "permission": "READ"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "CASE_SHARED_SUCCESSFULLY")

        # Verify role assignment
        self.case.refresh_from_db()
        self.assertTrue(self.case.assigned_legal_officers.filter(username="legal_sih").exists())

        # Verify access permission record is created
        perm = AccessPermission.objects.get(user=self.legal, case=self.case)
        self.assertEqual(perm.permission_type, "READ")

        # Verify audit trail record is generated
        audit_event = AuditEvent.objects.filter(action="USER_PERMISSION_CHANGED").last()
        self.assertIsNotNone(audit_event)
        self.assertIn("legal_sih", audit_event.details)

        # 2. Test that an unauthorized user cannot modify permissions
        self.client.force_authenticate(user=self.investigator)
        response = self.client.post(
            f"/api/cases/{self.case.case_id}/share/",
            {"username": "legal_sih", "permission": "READ"},
            format="json"
        )
        self.assertEqual(response.status_code, 403)  # Forbidden

        # 3. Test that unauthorized user cannot read documents they aren't shared with
        unauthorized_user = User.objects.create_user(
            username="unauth_sih", email="unauth@test.com", password="SecurePass123!", role=Role.INVESTIGATOR
        )
        self.client.force_authenticate(user=unauthorized_user)
        response = self.client.get(f"/api/cases/{self.case.case_id}/documents/")
        self.assertEqual(response.status_code, 403)  # Denied

        # 4. Revoke access (only creator/admin can)
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(
            f"/api/cases/{self.case.case_id}/share/",
            {"username": "legal_sih"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "CASE_ACCESS_REVOKED")

        # Verify revoked in DB
        self.case.refresh_from_db()
        self.assertFalse(self.case.assigned_legal_officers.filter(username="legal_sih").exists())
        self.assertFalse(AccessPermission.objects.filter(user=self.legal, case=self.case).exists())

    def test_asset_lifecycle_transitions(self):
        """
        Verify Asset creation, retrieval, and full lifecycle transitions (Assign, Transfer, Maintenance, Return, Retire).
        """
        # 1. Register Asset
        response = self.client.post(
            "/api/assets/",
            {
                "asset_id": "POL-EQ-999",
                "asset_type": AssetType.LAPTOP,
                "asset_name": "Seized Laptop",
                "serial_number": "SN-999-X",
                "department": "Cyber Cell",
                "location": "Evidence Room 1"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        asset_id = response.data["id"]

        # Verify asset created
        asset = Asset.objects.get(pk=asset_id)
        self.assertEqual(asset.status, AssetStatus.AVAILABLE)

        # 2. Transition: ASSIGN to investigator
        response = self.client.post(
            f"/api/assets/{asset_id}/transition/",
            {
                "action": "ASSIGN",
                "holder_username": "inv_sih",
                "case_id": "CASE-TEST-001",
                "notes": "Assigned for forensic extraction",
                "location": "Lab Desk 4"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AssetStatus.ASSIGNED)

        # Verify assignment in DB
        asset.refresh_from_db()
        self.assertEqual(asset.current_holder, self.investigator)
        self.assertEqual(asset.case, self.case)
        self.assertEqual(asset.location, "Lab Desk 4")

        # 3. Transition: TRANSFER to legal officer
        response = self.client.post(
            f"/api/assets/{asset_id}/transition/",
            {
                "action": "TRANSFER",
                "holder_username": "legal_sih",
                "notes": "Transferred for court presentation",
                "location": "Prosecution Office"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AssetStatus.TRANSFERRED)
        asset.refresh_from_db()
        self.assertEqual(asset.current_holder, self.legal)
        self.assertEqual(asset.location, "Prosecution Office")

        # 4. Transition: MAINTENANCE
        response = self.client.post(
            f"/api/assets/{asset_id}/transition/",
            {
                "action": "MAINTENANCE",
                "notes": "System diagnostic",
                "location": "Hardware Lab 1"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AssetStatus.MAINTENANCE)
        asset.refresh_from_db()
        self.assertNil = getattr(self, "assertNil", lambda x: self.assertIsNone(x))
        self.assertIsNone(asset.current_holder)
        self.assertEqual(asset.location, "Hardware Lab 1")

        # 5. Transition: RETURN
        response = self.client.post(
            f"/api/assets/{asset_id}/transition/",
            {
                "action": "RETURN",
                "notes": "Returned back to base registry",
                "location": "Central Vault"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AssetStatus.AVAILABLE)
        asset.refresh_from_db()
        self.assertEqual(asset.location, "Central Vault")

        # 6. Transition: RETIRE
        response = self.client.post(
            f"/api/assets/{asset_id}/transition/",
            {
                "action": "RETIRE",
                "notes": "End of service life disposal",
                "location": "Disposal Registry"
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], AssetStatus.RETIRED)

        # Verify audit events generated for transitions
        audit_event = AuditEvent.objects.filter(details__contains="POL-EQ-999").last()
        self.assertIsNotNone(audit_event)

    def test_compliance_overview(self):
        """
        Verify compliance dashboard calculations.
        """
        response = self.client.get("/api/compliance/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.data)
        self.assertIn("controls", response.data)
        self.assertIn("stats", response.data)

        # Assert stats return actual counts matching DB
        stats = response.data["stats"]
        self.assertEqual(stats["total_documents"], 1)
        self.assertEqual(stats["legal_holds_active"], 0)
