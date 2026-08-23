from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.users.models import Role, AccessPermission

User = get_user_model()


class UserAuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="admin_test",
            email="admin@test.com",
            password="TestPassword123!",
            role=Role.ADMIN,
        )
        self.investigator = User.objects.create_user(
            username="investigator_test",
            email="investigator@test.com",
            password="TestPassword123!",
            role=Role.INVESTIGATOR,
        )

    def test_user_roles(self):
        self.assertTrue(self.admin.is_admin())
        self.assertTrue(self.investigator.is_investigator())
        self.assertFalse(self.investigator.is_admin())

    def test_jwt_login(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "admin_test", "password": "TestPassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_invalid_login(self):
        response = self.client.post(
            "/api/auth/token/",
            {"username": "admin_test", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_seed_demo_data(self):
        from django.core.management import call_command
        from django.contrib.auth import authenticate
        import os

        # Set custom demo password via environment variable to test configuration ability
        os.environ["DEMO_ADMIN_PASSWORD"] = "SecurePass123!"

        # Call seed_demo_data first time
        call_command("seed_demo_data")

        # Check users are created
        admin_user = User.objects.get(username="admin")
        self.assertEqual(admin_user.role, Role.ADMIN)
        self.assertTrue(admin_user.is_superuser)

        # Check passwords authenticate correctly
        authenticated_user = authenticate(username="admin", password="SecurePass123!")
        self.assertIsNotNone(authenticated_user)
        self.assertEqual(authenticated_user.username, "admin")

        # Call seed_demo_data a second time to verify idempotency
        call_command("seed_demo_data")

        # Verify no duplicate user is created
        self.assertEqual(User.objects.filter(username="admin").count(), 1)
        
        # Verify JWT login still works for the seeded user
        response = self.client.post(
            "/api/auth/token/",
            {"username": "admin", "password": "SecurePass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

