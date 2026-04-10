from flask import Flask, request, jsonify, render_template_string
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

app = Flask(__name__)

# ─── Load or train models ────────────────────────────────────────────────────
def train_and_save():
    df = pd.read_csv("house_rent_data.csv")
    X = df.drop(columns="Rent")
    y = df["Rent"]

    categorical_cols = ["City", "Furnishing Status", "Tenant Preferred"]
    numeric_cols     = ["Area (sqft)", "BHK", "Bathroom"]

    preproc = ColumnTransformer(transformers=[
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_cols),
        ("num", "passthrough", numeric_cols)
    ])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    lr_pipe = Pipeline([("preprocessor", preproc), ("regressor", LinearRegression())])
    lr_pipe.fit(X_train, y_train)

    rf_pipe = Pipeline([("preprocessor", preproc),("regressor", RandomForestRegressor(n_estimators=50, max_depth=15, min_samples_leaf=2, random_state=42, n_jobs=-1))])
    rf_pipe.fit(X_train, y_train)

    def rmse(yt, yp): return float(np.sqrt(mean_squared_error(yt, yp)))

    metrics = {
        "Linear Regression": {"r2": round(r2_score(y_test, lr_pipe.predict(X_test)), 4),
                               "rmse": round(rmse(y_test, lr_pipe.predict(X_test)), 2)},
        "Random Forest":      {"r2": round(r2_score(y_test, rf_pipe.predict(X_test)), 4),
                               "rmse": round(rmse(y_test, rf_pipe.predict(X_test)), 2)},
    }

   # compress=3 drastically reduces the file size
    joblib.dump(rf_pipe, "rf_model.joblib", compress=3)
    joblib.dump(lr_pipe, "lr_model.joblib", compress=3)
    return rf_pipe, lr_pipe, metrics

def load_models():
    if os.path.exists("rf_model.joblib") and os.path.exists("lr_model.joblib"):
        rf = joblib.load("rf_model.joblib")
        lr = joblib.load("lr_model.joblib")
        # compute metrics
        df = pd.read_csv("house_rent_data.csv")
        X = df.drop(columns="Rent"); y = df["Rent"]
        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        def rmse(yt, yp): return float(np.sqrt(mean_squared_error(yt, yp)))
        metrics = {
            "Linear Regression": {"r2": round(r2_score(y_test, lr.predict(X_test)), 4),
                                   "rmse": round(rmse(y_test, lr.predict(X_test)), 2)},
            "Random Forest":      {"r2": round(r2_score(y_test, rf.predict(X_test)), 4),
                                   "rmse": round(rmse(y_test, rf.predict(X_test)), 2)},
        }
        return rf, lr, metrics
    return train_and_save()

rf_model, lr_model, MODEL_METRICS = load_models()
print("Models ready ✓")
print(f"  RF  → R²={MODEL_METRICS['Random Forest']['r2']}  RMSE=₹{MODEL_METRICS['Random Forest']['rmse']}")
print(f"  LR  → R²={MODEL_METRICS['Linear Regression']['r2']}  RMSE=₹{MODEL_METRICS['Linear Regression']['rmse']}")

# ─── Routes ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    with open("templates/index.html", encoding="utf-8") as f:
        return render_template_string(f.read(), metrics=MODEL_METRICS)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    try:
        inp = pd.DataFrame([{
            "City":              data["city"],
            "Area (sqft)":       int(data["area"]),
            "BHK":               int(data["bhk"]),
            "Bathroom":          int(data["bathroom"]),
            "Furnishing Status": data["furnishing"],
            "Tenant Preferred":  data["tenant"],
        }])
        model = rf_model if data.get("model") == "Random Forest" else lr_model
        pred  = float(model.predict(inp)[0])
        key   = "Random Forest" if data.get("model") == "Random Forest" else "Linear Regression"
        return jsonify({"rent": round(pred), "r2": MODEL_METRICS[key]["r2"],
                        "rmse": MODEL_METRICS[key]["rmse"], "model": key})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/metrics")
def metrics():
    return jsonify(MODEL_METRICS)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
