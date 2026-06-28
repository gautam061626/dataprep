import io
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pandas as pd
import json
import numpy as np

# Import custom managers
from backend.data_manager import DataManager
from backend.ml_manager import MLManager
from backend.report_manager import ReportManager

app = FastAPI(title="DataPrep Studio API", version="1.0.5")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory singletons
data_manager = DataManager()
ml_manager = MLManager()

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    delimiter: str = Form(","),
    has_headers: bool = Form(True)
):
    try:
        content = await file.read()
        # Delimiter escapes like \t
        if delimiter == "\\t" or delimiter == "\t":
            delimiter = "\t"
            
        data_manager.load_csv(content, file.filename, delimiter, has_headers)
        
        # Return dashboard details
        summary = data_manager.get_summary_stats()
        profile = data_manager.get_profile()
        return {
            "status": "success",
            "message": f"Successfully parsed and loaded {summary['rows']} records.",
            "summary": summary,
            "profile": profile
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parsing Error: {str(e)}")

@app.post("/api/load_sample")
async def load_sample():
    # Load customer churn sample dataset
    sample_content = """CustomerID,Gender,Age,Tenure,Contract,MonthlyCharges,TotalCharges,PaymentMethod,Churn,JoinedDate
CUST-1024,Male,34,12,Month-to-month,58.75,705.00,Electronic check,No,2024-01-15
CUST-1025,Female,45,24,One year,84.20,2020.80,Mailed check,No,2023-05-20
CUST-1026,Male,,8,Month-to-month,49.95,399.60,Electronic check,Yes,2024-10-02
CUST-1027,Female,22,1,Month-to-month,20.40,20.40,Mailed check,Yes,2025-05-11
CUST-1028,Male,67,48,Two year,102.30,4910.40,Credit card,No,2021-08-30
CUST-1029,Female,53,36,Two year,95.85,3450.60,Bank transfer,No,2022-09-12
CUST-1030,Male,29,12,Month-to-month,2500.00,3000.00,Electronic check,No,2024-02-28
CUST-1031,Female,41,,Month-to-month,64.15,769.80,Credit card,Yes,2024-04-18
CUST-1032,Male,38,18,One year,75.30,1355.40,Mailed check,No,2023-11-05
CUST-1033,Female,59,60,Two year,115.60,6936.00,Credit card,No,2020-06-25
CUST-1034,Male,24,2,Month-to-month,45.25,90.50,Electronic check,Yes,2025-04-01
CUST-1035,Female,62,54,Two year,,5929.20,Bank transfer,No,2020-12-10
CUST-1036,Male,31,6,Month-to-month,55.00,330.00,Electronic check,No,2024-11-22
CUST-1037,Female,47,15,One year,70.15,1052.25,Credit card,No,2024-03-08
CUST-1038,Male,73,36,Two year,98.20,3535.20,Bank transfer,No,2022-04-14
CUST-1039,Female,19,4,Month-to-month,20.15,,Mailed check,No,2025-02-18
CUST-1040,Male,43,24,One year,85.90,2061.60,Electronic check,Yes,2023-07-29
CUST-1041,Female,,9,Month-to-month,50.45,454.05,Mailed check,No,2024-09-01
CUST-1042,Male,55,42,Two year,105.10,4414.20,Credit card,No,2022-02-10
CUST-1042,Male,55,42,Two year,105.10,4414.20,Credit card,No,2022-02-10
CUST-1043,Female,28,10,Month-to-month,60.20,602.00,Bank transfer,Yes,2024-08-15
CUST-1044,Male,60,3,Month-to-month,25.30,75.90,Mailed check,No,2025-03-22
CUST-1045,Female,37,28,One year,82.45,2308.60,Credit card,No,2023-01-05
CUST-1046,Male,50,15,Month-to-month,65.80,987.00,Electronic check,No,2024-05-12
CUST-1047,Female,23,5,Month-to-month,40.10,200.50,Mailed check,Yes,2025-01-30
CUST-1048,Male,46,30,One year,88.15,2644.50,Bank transfer,No,2022-12-04
CUST-1049,Female,71,52,Two year,110.40,5740.80,Credit card,No,2021-04-19
CUST-1050,Male,33,12,Month-to-month,55.40,664.80,Electronic check,Yes,2024-06-15
CUST-1051,Female,,2,Month-to-month,20.05,40.10,Mailed check,No,2025-04-20
CUST-1052,Male,65,45,Two year,101.90,4585.50,Bank transfer,No,2022-03-01
CUST-1053,Female,26,7,Month-to-month,48.60,340.20,Electronic check,Yes,2024-11-10
CUST-1054,Male,52,36,One year,90.25,3249.00,Credit card,No,2022-07-28
CUST-1055,Female,40,14,Month-to-month,62.80,879.20,Mailed check,No,2024-03-12
CUST-1056,Male,75,60,Two year,118.45,7107.00,Bank transfer,No,2020-08-15
CUST-1057,Female,30,4,Month-to-month,44.90,179.60,Electronic check,Yes,2025-02-05
CUST-1058,Male,48,22,One year,80.10,1762.20,Credit card,No,2023-09-22
CUST-1059,Female,56,40,Two year,98.60,3944.00,Bank transfer,No,2022-05-18
CUST-1060,Male,21,1,Month-to-month,19.90,19.90,Mailed check,No,2025-05-01
CUST-1061,Female,64,48,Two year,104.75,5028.00,Credit card,No,2021-10-10
CUST-1062,Male,44,16,One year,,1232.00,Bank transfer,No,2023-12-05"""
    
    data_manager.load_csv(sample_content.encode('utf-8'), "customer_churn.csv", ",", True)
    return {
        "status": "success",
        "summary": data_manager.get_summary_stats(),
        "profile": data_manager.get_profile()
    }

@app.get("/api/dashboard")
async def get_dashboard():
    if data_manager.df is None:
        return {"loaded": False}
    return {
        "loaded": True,
        "summary": data_manager.get_summary_stats()
    }

@app.get("/api/profile")
async def get_profile():
    if data_manager.df is None:
        return {"loaded": False}
    return {
        "loaded": True,
        "profile": data_manager.get_profile()
    }

@app.get("/api/profile/categorical")
async def get_categorical_profile(column: str = Query(...)):
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded")
    return {
        "column": column,
        "counts": data_manager.get_categorical_counts(column)
    }

@app.get("/api/grid")
async def get_grid(
    page: int = 1,
    page_size: int = 10,
    search: str = "",
    sort_col: str = "",
    sort_asc: bool = True
):
    if data_manager.df is None:
        return {"loaded": False, "rows": []}
    
    grid_data = data_manager.get_grid(page, page_size, search, sort_col, sort_asc)
    grid_data["loaded"] = True
    return grid_data

@app.post("/api/edit")
async def edit_cell(
    row_id: int = Form(...),
    column: str = Form(...),
    value: str = Form(...)
):
    success = data_manager.edit_cell(row_id, column, value)
    if not success:
        raise HTTPException(status_code=400, detail="Error modifying grid cell value.")
    return {"status": "success", "summary": data_manager.get_summary_stats()}

@app.post("/api/clean")
async def clean_operation(
    action: str = Form(...),
    column: str = Form(""),
    strategy: str = Form(""),
    custom_val: str = Form(""),
    find_val: str = Form(""),
    sub_val: str = Form(""),
    casing_op: str = Form(""),
    outlier_thresh: float = Form(1.5),
    rename_to: str = Form("")
):
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    if action == "remove_duplicates":
        data_manager.remove_duplicates()
    elif action == "drop_missing":
        data_manager.drop_missing(column)
    elif action == "fill_missing":
        data_manager.fill_missing(column, strategy, custom_val)
    elif action == "drop_column":
        data_manager.drop_column(column)
    elif action == "rename_column":
        success = data_manager.rename_column(column, rename_to)
        if not success:
            raise HTTPException(status_code=400, detail="Renaming failed. Verify destination does not already exist.")
    elif action == "replace_values":
        data_manager.replace_values(column, find_val, sub_val)
    elif action == "standardize_strings":
        data_manager.standardize_strings(column, casing_op)
    elif action == "remove_outliers":
        data_manager.remove_outliers(column, outlier_thresh)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported operation: {action}")

    return {
        "status": "success",
        "summary": data_manager.get_summary_stats(),
        "profile": data_manager.get_profile()
    }

@app.post("/api/clean/undo")
async def clean_undo():
    success = data_manager.undo()
    if not success:
        return {"status": "error", "message": "Undo stack is empty."}
    return {
        "status": "success",
        "summary": data_manager.get_summary_stats(),
        "profile": data_manager.get_profile()
    }

@app.post("/api/clean/redo")
async def clean_redo():
    success = data_manager.redo()
    if not success:
        return {"status": "error", "message": "Redo stack is empty."}
    return {
        "status": "success",
        "summary": data_manager.get_summary_stats(),
        "profile": data_manager.get_profile()
    }

@app.post("/api/clean/reset")
async def clean_reset():
    success = data_manager.reset()
    if not success:
        return {"status": "error", "message": "No active dataset loaded."}
    return {
        "status": "success",
        "summary": data_manager.get_summary_stats(),
        "profile": data_manager.get_profile()
    }

# Interactive Plotly Charts API
@app.post("/api/charts")
async def generate_charts(
    chart_type: str = Form(...),
    x_col: str = Form(""),
    y_col: str = Form(""),
    filter_col: str = Form(""),
    filter_val: str = Form("")
):
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No loaded dataset.")

    df = data_manager.df.copy()
    
    # Apply chart filter if specified
    if filter_col and filter_col in data_manager.columns and filter_val:
        df = df[df[filter_col].astype(str) == str(filter_val)]

    # Clean missing items from variables to avoid crashes
    cols_to_clean = []
    if x_col: cols_to_clean.append(x_col)
    if y_col: cols_to_clean.append(y_col)
    df = df.dropna(subset=cols_to_clean)

    if df.empty:
        return {"error": "Dataset contains no rows matching filter criteria."}

    import plotly.express as px
    import plotly.io as pio

    try:
        if chart_type == "bar":
            # Bar chart aggregates count or sums if y is numeric
            if y_col and data_manager.column_types.get(y_col) == "Numeric":
                df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
                agg = df.groupby(x_col, as_index=False)[y_col].mean()
                fig = px.bar(agg, x=x_col, y=y_col, title=f"Average {y_col} by {x_col}")
            else:
                agg = df.groupby(x_col, as_index=False).size().rename(columns={"size": "Count"})
                fig = px.bar(agg, x=x_col, y="Count", title=f"Frequency Count of {x_col}")
        
        elif chart_type == "histogram":
            df[x_col] = pd.to_numeric(df[x_col], errors='coerce').dropna()
            fig = px.histogram(df, x=x_col, title=f"Distribution of {x_col}")
        
        elif chart_type == "scatter":
            df[x_col] = pd.to_numeric(df[x_col], errors='coerce')
            df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
            fig = px.scatter(df, x=x_col, y=y_col, title=f"{y_col} vs. {x_col}")
            
        elif chart_type == "line":
            df[x_col] = pd.to_numeric(df[x_col], errors='coerce')
            df[y_col] = pd.to_numeric(df[y_col], errors='coerce')
            # Sort by X for proper lines
            df_sorted = df.sort_values(by=x_col)
            fig = px.line(df_sorted, x=x_col, y=y_col, title=f"{y_col} trend by {x_col}")
            
        elif chart_type == "pie":
            agg = df.groupby(x_col).size().reset_index(name='count')
            fig = px.pie(agg, values='count', names=x_col, title=f"Share proportions of {x_col}")
            
        elif chart_type == "boxplot":
            if x_col:
                fig = px.box(df, x=x_col, y=y_col, title=f"Boxplot of {y_col} grouped by {x_col}")
            else:
                fig = px.box(df, y=y_col, title=f"Boxplot of {y_col}")
                
        elif chart_type == "heatmap":
            numeric_cols = [c for c in data_manager.columns if data_manager.column_types.get(c) == "Numeric"]
            if len(numeric_cols) < 2:
                return {"error": "Correlation heatmap requires at least 2 numeric variables."}
            
            corr = df[numeric_cols].apply(pd.to_numeric, errors='coerce').corr()
            fig = px.imshow(corr, text_auto=True, title="Variable Correlation Matrix")
            
        else:
            return {"error": f"Unknown chart type: {chart_type}"}

        # Apply early-2000 style formatting to Plotly chart
        fig.update_layout(
            font_family="Tahoma, sans-serif",
            font_size=11,
            paper_bgcolor="#F4F3EE",
            plot_bgcolor="#FFFFFF",
            margin=dict(l=40, r=40, t=50, b=40),
            title_font_color="#003399",
            title_font_size=13
        )
        fig.update_xaxes(showgrid=True, gridwidth=0.5, gridcolor="#D0D0D0", linecolor="#808080")
        fig.update_yaxes(showgrid=True, gridwidth=0.5, gridcolor="#D0D0D0", linecolor="#808080")

        # Matplotlib static base64 rendering as fallback / static image save
        # Create matching matplotlib layout
        fig_matplotlib, ax = plt.subplots(figsize=(6, 3.4))
        fig_matplotlib.patch.set_facecolor('#F4F3EE')
        ax.set_facecolor('#FFFFFF')
        
        # Simple rendering wrapper for matplotlib static exports
        if chart_type in ["bar", "pie"]:
            # Simple bar
            labels = agg[x_col].astype(str).tolist()
            heights = agg.iloc[:, 1].tolist()
            ax.bar(labels, heights, color='#3A93FF', edgecolor='#000000', linewidth=1)
            ax.set_title(fig.layout.title.text, fontsize=11, color='#003399', weight='bold')
            plt.xticks(rotation=15, fontsize=8)
        elif chart_type == "histogram":
            ax.hist(pd.to_numeric(df[x_col]), bins=10, color='#3A93FF', edgecolor='#000000')
            ax.set_title(fig.layout.title.text, fontsize=11, color='#003399', weight='bold')
        elif chart_type == "scatter":
            ax.scatter(pd.to_numeric(df[x_col]), pd.to_numeric(df[y_col]), color='#0055EA')
            ax.set_title(fig.layout.title.text, fontsize=11, color='#003399', weight='bold')
        elif chart_type == "line":
            df_sorted = df.sort_values(by=x_col)
            ax.plot(pd.to_numeric(df_sorted[x_col]), pd.to_numeric(df_sorted[y_col]), color='#0055EA', marker='o')
            ax.set_title(fig.layout.title.text, fontsize=11, color='#003399', weight='bold')
        else:
            ax.text(0.5, 0.5, "[Matplotlib preview only available\nfor Bar, Histogram, Line & Scatter]", ha='center', va='center')
        
        ax.set_xlabel(x_col, fontsize=9)
        if y_col: ax.set_ylabel(y_col, fontsize=9)
        ax.grid(True, linestyle=':', color='#A0A0A0')
        matplotlib_img_b64 = fig_to_base64(fig_matplotlib)

        return {
            "plotly_json": json.loads(pio.to_json(fig)),
            "static_img": matplotlib_img_b64
        }
    except Exception as e:
        return {"error": f"Visualization Error: {str(e)}"}

# ML Training endpoint
@app.post("/api/ml")
async def train_ml(
    model_type: str = Form(...),
    target_col: str = Form(...),
    feature_cols: str = Form(...), # JSON stringified array of feature names
    train_split: float = Form(80.0) # percentage
):
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")
    
    try:
        x_cols = json.loads(feature_cols)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feature columns list layout format.")

    if not x_cols:
        raise HTTPException(status_code=400, detail="Please select at least 1 feature column (X).")
        
    if target_col in x_cols:
        raise HTTPException(status_code=400, detail="Target variable (Y) cannot be included in features list (X).")

    train_ratio = train_split / 100.0
    results = ml_manager.train_and_evaluate(
        data_manager.df, model_type, x_cols, target_col, train_ratio, data_manager.column_types
    )
    
    if "error" in results:
        raise HTTPException(status_code=400, detail=results["error"])
        
    return results

# Audit Report Endpoints
@app.get("/api/report/html", response_class=HTMLResponse)
async def get_html_report():
    if data_manager.df is None:
        return "<h3>No active dataset loaded. Please upload a dataset first.</h3>"
    summary = data_manager.get_summary_stats()
    profile = data_manager.get_profile()
    html_content = ReportManager.generate_html_report(summary, profile, data_manager.operations_log)
    return html_content

@app.get("/api/report/pdf")
async def get_pdf_report():
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")
    
    summary = data_manager.get_summary_stats()
    profile = data_manager.get_profile()
    pdf_bytes = ReportManager.generate_pdf_report(summary, profile, data_manager.operations_log)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=dataprep_audit_{data_manager.filename.replace('.csv', '')}.pdf"}
    )

# Export endpoints
@app.post("/api/export")
async def export_dataset(
    format: str = Form(...),
    filename: str = Form("clean_export"),
    delimiter: str = Form(","),
    include_headers: bool = Form(True),
    sql_tablename: str = Form("prepared_dataset")
):
    if data_manager.df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded to export.")

    # We drop the internal _rowId during export
    export_df = data_manager.df.drop(columns=["_rowId"], errors='ignore')

    if format == "csv":
        if delimiter == "\\t":
            delimiter = "\t"
        csv_data = export_df.to_csv(sep=delimiter, index=False, header=include_headers)
        return StreamingResponse(
            io.BytesIO(csv_data.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )
        
    elif format == "json":
        json_data = export_df.to_json(orient='records', indent=2)
        return StreamingResponse(
            io.BytesIO(json_data.encode('utf-8')),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}.json"}
        )
        
    elif format == "excel":
        # Write Excel to BytesIO using openpyxl
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
            export_df.to_excel(writer, index=False)
        excel_buffer.seek(0)
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"}
        )
        
    elif format == "sql":
        # Generate raw SQL Insert statements
        sql_lines = []
        sql_lines.append(f"-- SQL Insert Script generated by DataPrep Studio\n")
        sql_lines.append(f"-- Table Name: {sql_tablename}\n")
        sql_lines.append(f"-- Rows Count: {len(export_df)}\n\n")
        
        cols = ", ".join([f"`{c}`" for c in export_df.columns])
        
        for _, row in export_df.iterrows():
            values = []
            for val in row:
                if pd.isna(val):
                    values.append("NULL")
                elif isinstance(val, (int, float)):
                    values.append(str(val))
                else:
                    escaped_str = str(val).replace("'", "''")
                    values.append(f"'{escaped_str}'")
            
            vals_str = ", ".join(values)
            sql_lines.append(f"INSERT INTO {sql_tablename} ({cols}) VALUES ({vals_str});\n")
            
        sql_content = "".join(sql_lines)
        return StreamingResponse(
            io.BytesIO(sql_content.encode('utf-8')),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}.sql"}
        )
        
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format type: {format}")

# Serves components, pages, and frontend at root
app.mount("/components", StaticFiles(directory="components"), name="components")
app.mount("/pages", StaticFiles(directory="pages"), name="pages")
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

