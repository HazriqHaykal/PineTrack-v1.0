"""
AgroPlanner AI Model Training Script

Model 1: Decision Tree Classifier
- Predicts task execution status: Proceed / Pending / Stop

Model 2: Random Forest Regressor
- Predicts delay_days for rescheduling

NOTE:
This script uses expert-rule-based synthetic data to bootstrap the models.
In production, retrain using real farm operational history.
"""

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, mean_absolute_error
import joblib
import os

# -----------------------------
# Configuration
# -----------------------------
RANDOM_SEED = 42
N_SAMPLES = 2000

MODEL_DIR = "../ai_models"
os.makedirs(MODEL_DIR, exist_ok=True)

# -----------------------------
# Synthetic Data Generator
# -----------------------------
def generate_synthetic_dataset(n_samples: int) -> pd.DataFrame:
    np.random.seed(RANDOM_SEED)

    data = {
        "soil_moisture": np.random.uniform(30, 95, n_samples),
        "temperature": np.random.uniform(20, 40, n_samples),
        "nitrogen": np.random.uniform(20, 150, n_samples),
        "rain_today": np.random.uniform(0, 15, n_samples),
        "rain_next_3d": np.random.uniform(0, 30, n_samples),
        "task_type": np.random.choice(
            ["fertilization", "weeding", "hormone", "land-prep", "inspection"],
            n_samples
        )
    }

    df = pd.DataFrame(data)

    # -----------------------------
    # Expert-rule labels (Classifier)
    # -----------------------------
    def assign_status(row):
        if row["soil_moisture"] > 85 or row["rain_today"] > 8:
            return "Stop"
        elif row["soil_moisture"] > 75 or row["rain_today"] > 3:
            return "Pending"
        else:
            return "Proceed"

    df["status"] = df.apply(assign_status, axis=1)

    # -----------------------------
    # Expert-rule labels (Regressor)
    # -----------------------------
    def assign_delay(row):
        if row["status"] == "Stop":
            return np.random.randint(4, 7)
        elif row["status"] == "Pending":
            return np.random.randint(2, 4)
        else:
            return 0

    df["delay_days"] = df.apply(assign_delay, axis=1)

    return df


# -----------------------------
# Prepare Dataset
# -----------------------------
df = generate_synthetic_dataset(N_SAMPLES)

FEATURES = [
    "soil_moisture",
    "temperature",
    "nitrogen",
    "rain_today",
    "rain_next_3d",
    "task_type"
]

X = df[FEATURES]

# -----------------------------
# Shared Preprocessing
# -----------------------------
numeric_features = [
    "soil_moisture",
    "temperature",
    "nitrogen",
    "rain_today",
    "rain_next_3d"
]

categorical_features = ["task_type"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", "passthrough", numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features)
    ]
)

# =====================================================
# Model 1: Decision Tree Classifier (Proceed/Pending/Stop)
# =====================================================
print("\nTraining Decision Tree Classifier...")

y_class = df["status"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y_class, test_size=0.2, random_state=RANDOM_SEED, stratify=y_class
)

classifier_pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("model", DecisionTreeClassifier(
        max_depth=5,
        min_samples_leaf=20,
        random_state=RANDOM_SEED
    ))
])

classifier_pipeline.fit(X_train, y_train)

y_pred = classifier_pipeline.predict(X_test)

print("\nClassifier Performance:")
print(classification_report(y_test, y_pred))

joblib.dump(
    classifier_pipeline,
    os.path.join(MODEL_DIR, "status_classifier.pkl")
)

print("Saved status_classifier.pkl")

# =====================================================
# Model 2: Random Forest Regressor (Delay Days)
# =====================================================
print("\nTraining Random Forest Regressor...")

y_reg = df["delay_days"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y_reg, test_size=0.2, random_state=RANDOM_SEED
)

regressor_pipeline = Pipeline(steps=[
    ("preprocessor", preprocessor),
    ("model", RandomForestRegressor(
        n_estimators=150,
        max_depth=6,
        min_samples_leaf=15,
        random_state=RANDOM_SEED
    ))
])

regressor_pipeline.fit(X_train, y_train)

y_pred = regressor_pipeline.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
print(f"\nRegressor MAE: {mae:.2f} days")

joblib.dump(
    regressor_pipeline,
    os.path.join(MODEL_DIR, "delay_predictor.pkl")
)

print("Saved delay_predictor.pkl")

print("\nTraining completed successfully.")
