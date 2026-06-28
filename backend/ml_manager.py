import numpy as np
import pandas as pd
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, confusion_matrix, roc_curve, auc,
    mean_squared_error, mean_absolute_error, r2_score
)

# Models
from sklearn.linear_model import LinearRegression, Ridge, LogisticRegression
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.naive_bayes import GaussianNB

# SHAP
import shap

def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return "data:image/png;base64," + img_str

class MLManager:
    def __init__(self):
        self.model = None
        self.model_type = ""
        self.feature_cols = []
        self.target_col = ""
        self.is_classification = False

    def train_and_evaluate(self, df: pd.DataFrame, model_key: str, x_cols: list, y_col: str, train_ratio: float, column_types: dict):
        # Prevent rowId from leaking
        x_cols = [c for c in x_cols if c != "_rowId"]
        
        # Clean target and features of nulls
        clean_df = df[x_cols + [y_col]].dropna().copy()
        if len(clean_df) < 5:
            return {"error": f"Insufficient data for training. Found {len(clean_df)} complete rows after dropping missing values."}

        # Subsample large datasets to ensure fast, memory-safe training and SHAP explanations
        max_ml_rows = 30000
        if len(clean_df) > max_ml_rows:
            clean_df = clean_df.sample(n=max_ml_rows, random_state=42)

        self.model_type = model_key
        self.feature_cols = x_cols
        self.target_col = y_col
        
        # Determine task type (classification or regression)
        # Naive Bayes, Logistic Regression, SVC, KNN classifier, etc. are classification
        # Linear, Ridge, SVR, etc. are regression
        # For tree models, determine based on target type or user model selection
        classification_models = ["logistic", "knn_class", "tree_class", "forest_class", "svm_class", "naive_bayes"]
        regression_models = ["linear", "ridge", "tree_reg", "forest_reg", "svm_reg", "knn_reg"]
        
        if model_key in classification_models:
            self.is_classification = True
        elif model_key in regression_models:
            self.is_classification = False
        else:
            # Fallback based on target column type
            self.is_classification = column_types.get(y_col) != "Numeric"

        # Preprocess features (X)
        X_raw = clean_df[x_cols]
        # One-hot encode any categorical columns in X
        X = pd.get_dummies(X_raw, drop_first=True)
        final_feature_names = X.columns.tolist()

        # Preprocess target (y)
        y = clean_df[y_col]
        label_mapping = None
        if self.is_classification:
            # Encode target as integer labels
            le = LabelEncoder()
            y = le.fit_transform(y.astype(str))
            label_mapping = {int(i): str(c) for i, c in enumerate(le.classes_)}
        else:
            y = pd.to_numeric(y, errors='coerce').fillna(0.0).values

        # Train/Test Split
        X_train, X_test, y_train, y_test = train_test_split(
            X.values, y, train_size=train_ratio, random_state=42
        )

        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Initialize model
        if model_key == "linear":
            model = LinearRegression()
        elif model_key == "ridge":
            model = Ridge(alpha=1.0)
        elif model_key == "logistic":
            model = LogisticRegression(max_iter=1000)
        elif model_key == "knn_class":
            model = KNeighborsClassifier(n_neighbors=5)
        elif model_key == "knn_reg":
            model = KNeighborsRegressor(n_neighbors=5)
        elif model_key == "tree_class":
            model = DecisionTreeClassifier(max_depth=5, random_state=42)
        elif model_key == "tree_reg":
            model = DecisionTreeRegressor(max_depth=5, random_state=42)
        elif model_key == "forest_class":
            model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        elif model_key == "forest_reg":
            model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        elif model_key == "svm_class":
            model = SVC(probability=True, random_state=42)
        elif model_key == "svm_reg":
            model = SVR()
        elif model_key == "naive_bayes":
            model = GaussianNB()
        else:
            return {"error": f"Unknown model type: {model_key}"}

        # Train
        model.fit(X_train_scaled, y_train)
        self.model = model

        # Predict
        y_pred = model.predict(X_test_scaled)
        
        # Calculate Metrics
        results = {
            "model_name": model.__class__.__name__,
            "is_classification": self.is_classification,
            "train_samples": len(X_train),
            "test_samples": len(X_test)
        }

        plots = {}

        if self.is_classification:
            acc = accuracy_score(y_test, y_pred)
            prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted', zero_division=0)
            
            results["metrics"] = {
                "Accuracy": f"{round(acc * 100, 2)}%",
                "Precision (Weighted)": f"{round(prec * 100, 2)}%",
                "Recall (Weighted)": f"{round(rec * 100, 2)}%",
                "F1 Score": f"{round(f1, 4)}"
            }

            # Confusion Matrix Plot
            cm = confusion_matrix(y_test, y_pred)
            fig, ax = plt.subplots(figsize=(4, 3))
            ax.matshow(cm, cmap=plt.cm.Blues, alpha=0.3)
            for i in range(cm.shape[0]):
                for j in range(cm.shape[1]):
                    ax.text(x=j, y=i, s=str(cm[i, j]), va='center', ha='center', size='xx-large')
            
            classes = [label_mapping.get(i, f"Class {i}") for i in range(cm.shape[0])]
            ax.set_xticks(range(len(classes)))
            ax.set_yticks(range(len(classes)))
            ax.set_xticklabels(classes, fontsize=9)
            ax.set_yticklabels(classes, fontsize=9)
            ax.set_xlabel('Predicted Label', fontsize=9)
            ax.set_ylabel('True Label', fontsize=9)
            ax.set_title('Confusion Matrix', fontsize=10, pad=10)
            plots["confusion_matrix"] = fig_to_base64(fig)

            # ROC Curve Plot (for binary or multi-class handled gracefully)
            fig, ax = plt.subplots(figsize=(4, 3))
            if len(classes) == 2:
                # Binary classification ROC
                try:
                    if hasattr(model, "predict_proba"):
                        y_probs = model.predict_proba(X_test_scaled)[:, 1]
                    else:
                        y_probs = model.decision_function(X_test_scaled)
                    fpr, tpr, _ = roc_curve(y_test, y_probs)
                    roc_auc = auc(fpr, tpr)
                    ax.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.2f})')
                except Exception:
                    ax.text(0.5, 0.5, "ROC unavailable", ha='center', va='center')
            else:
                ax.text(0.5, 0.5, "ROC display only\nsupported for Binary target", ha='center', va='center', wrap=True)
            
            ax.plot([0, 1], [0, 1], color='navy', lw=1.5, linestyle='--')
            ax.set_xlim([0.0, 1.0])
            ax.set_ylim([0.0, 1.05])
            ax.set_xlabel('False Positive Rate', fontsize=9)
            ax.set_ylabel('True Positive Rate', fontsize=9)
            ax.set_title('Receiver Operating Characteristic', fontsize=10)
            ax.legend(loc="lower right", fontsize=8)
            plots["roc_curve"] = fig_to_base64(fig)

        else:
            mse = mean_squared_error(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            results["metrics"] = {
                "Mean Squared Error (MSE)": f"{round(mse, 4)}",
                "Mean Absolute Error (MAE)": f"{round(mae, 4)}",
                "R² Score": f"{round(r2, 4)}"
            }

            # Actual vs Predicted Scatter Plot
            fig, ax = plt.subplots(figsize=(4, 3))
            ax.scatter(y_test, y_pred, color='#0055EA', alpha=0.6, edgecolors='none', s=20)
            ideal_min = min(y_test.min(), y_pred.min())
            ideal_max = max(y_test.max(), y_pred.max())
            ax.plot([ideal_min, ideal_max], [ideal_min, ideal_max], color='red', lw=1.5, linestyle='--')
            ax.set_xlabel('Actual Target Value', fontsize=9)
            ax.set_ylabel('Predicted Target Value', fontsize=9)
            ax.set_title('Actual vs. Predicted', fontsize=10)
            plots["actual_vs_pred"] = fig_to_base64(fig)

        # Feature Importance Plot
        importance = None
        if hasattr(model, "feature_importances_"):
            importance = model.feature_importances_
        elif hasattr(model, "coef_"):
            # absolute coefficient size as proxy
            coef = model.coef_
            if coef.ndim > 1:
                importance = np.abs(coef[0])
            else:
                importance = np.abs(coef)

        if importance is not None and len(final_feature_names) > 0:
            indices = np.argsort(importance)[::-1][:10]  # Top 10
            top_features = [final_feature_names[i] for i in indices]
            top_importances = [float(importance[i]) for i in indices]

            fig, ax = plt.subplots(figsize=(4, 3))
            y_pos = np.arange(len(top_features))
            ax.barh(y_pos, top_importances, align='center', color='#107C41')
            ax.set_yticks(y_pos)
            ax.set_yticklabels(top_features, fontsize=8)
            ax.invert_yaxis()  # top-down list
            ax.set_xlabel('Relative Importance / Coefficient size', fontsize=9)
            ax.set_title('Feature Importance', fontsize=10)
            plots["feature_importance"] = fig_to_base64(fig)
            
            # Save textual importance
            results["feature_importances"] = {top_features[i]: top_importances[i] for i in range(len(top_features))}
        else:
            results["feature_importances"] = {}

        # SHAP Explanation Plot
        try:
            # SHAP explainer fallback tree/linear/kernel
            # Keep sample test size small (max 100 rows) for speed
            shap_test_size = min(len(X_test_scaled), 100)
            X_shap = X_test_scaled[:shap_test_size]
            
            # Pick proper explainer to avoid speed block
            if model_key in ["tree_class", "tree_reg", "forest_class", "forest_reg"]:
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(X_shap)
            elif model_key in ["linear", "ridge", "logistic"]:
                # Pass training distribution background
                explainer = shap.LinearExplainer(model, X_train_scaled[:100])
                shap_values = explainer.shap_values(X_shap)
            else:
                # Explainer fallback
                explainer = shap.Explainer(model.predict, X_train_scaled[:50])
                shap_values = explainer(X_shap).values

            fig, ax = plt.subplots(figsize=(5, 3))
            # Standard SHAP summary plot
            # Handle multi-class shap output shape (list of matrices)
            if isinstance(shap_values, list) and len(shap_values) > 0:
                # Standardize to one class for simple summary plotting
                shap.summary_plot(shap_values[0], X_shap, feature_names=final_feature_names, show=False, max_display=7)
            else:
                shap.summary_plot(shap_values, X_shap, feature_names=final_feature_names, show=False, max_display=7)
                
            plt.title('SHAP Feature Impact Analysis', fontsize=10, pad=10)
            plots["shap_explanation"] = fig_to_base64(fig)
        except Exception as e:
            # Graceful fallback plot
            fig, ax = plt.subplots(figsize=(5, 3))
            ax.text(0.5, 0.5, f"SHAP explanation plot unavailable\n({str(e)})", ha='center', va='center', wrap=True)
            ax.set_axis_off()
            plots["shap_explanation"] = fig_to_base64(fig)

        results["plots"] = plots
        return results
