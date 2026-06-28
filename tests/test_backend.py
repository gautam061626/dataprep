import unittest
import sys
import os
import json

# Ensure parent directory is in path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app

class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Create a mock CSV dataset string for testing
        # Exact duplicate row added (Row 4 is copy of Row 1)
        self.mock_csv = (
            "Id,Name,Age,Salary\n"
            "1,Alice,34,50000\n"
            "2,Bob,45,60000\n"
            "3,Charlie,,75000\n"
            "1,Alice,34,50000\n"  # Duplicate row (exact match)
            "5,Dave,62,110000\n"
            "6,Eva,29,48000\n"
            "7,Frank,38,72000\n"
            "8,Grace,51,95000\n"
            "9,Henry,41,85000\n"
            "10,Ivy,23,38000\n"
        )

    def test_01_upload_and_dashboard(self):
        # Test CSV Upload
        file_bytes = self.mock_csv.encode('utf-8')
        response = self.client.post(
            "/api/upload",
            files={"file": ("test_data.csv", file_bytes, "text/csv")},
            data={"delimiter": ",", "has_headers": "true"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["summary"]["rows"], 10)
        self.assertEqual(data["summary"]["columns"], 4)

        # Test Dashboard Info Retrieval
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["loaded"])
        self.assertEqual(data["summary"]["filename"], "test_data.csv")

    def test_02_profile_and_grid(self):
        # Test Data Profiling
        response = self.client.get("/api/profile")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["loaded"])
        
        # Verify column datatypes inferred
        profile = {col["name"]: col["type"] for col in data["profile"]}
        self.assertEqual(profile["Age"], "Numeric")
        self.assertEqual(profile["Name"], "Categorical")

        # Test Grid Paginated Retrieval
        response = self.client.get("/api/grid?page=1&page_size=3")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["loaded"])
        self.assertEqual(len(data["rows"]), 3)
        self.assertEqual(data["total"], 10)

    def test_03_clean_operations(self):
        # Test Remove Duplicates
        response = self.client.post("/api/clean", data={"action": "remove_duplicates"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["summary"]["rows"], 9)  # Duplicate was deleted
        self.assertEqual(data["summary"]["duplicates"], 0)

        # Test Handle Missing (Age null value imputation)
        response = self.client.post(
            "/api/clean",
            data={"action": "fill_missing", "column": "Age", "strategy": "mean"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["summary"]["missing_cells"], 0)  # Age null is filled

    def test_04_ml_models(self):
        # Test ML Training (Predict Salary using Age)
        feature_cols_json = json.dumps(["Age"])
        response = self.client.post(
            "/api/ml",
            data={
                "model_type": "linear",
                "target_col": "Salary",
                "feature_cols": feature_cols_json,
                "train_split": 75.0
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_name"], "LinearRegression")
        self.assertFalse(data["is_classification"])
        self.assertIn("metrics", data)

    def test_05_reports_and_exports(self):
        # Test Report HTML preview Endpoint
        response = self.client.get("/api/report/html")
        self.assertEqual(response.status_code, 200)
        self.assertIn("DATAPREP STUDIO AUDIT REPORT", response.text)

        # Test PDF download route
        response = self.client.get("/api/report/pdf")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")

        # Test Export file CSV download
        response = self.client.post(
            "/api/export",
            data={"format": "csv", "filename": "exported_test"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("Id,Name,Age,Salary", response.text)

if __name__ == "__main__":
    unittest.main()
