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
