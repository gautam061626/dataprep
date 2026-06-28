import pandas as pd
import numpy as np
import io
import math
from datetime import datetime

class DataManager:
    def __init__(self):
        self.df = None
        self.original_df = None
        self.filename = ""
        self.columns = []
        self.column_types = {}
        self.size_bytes = 0
        self.operations_log = []
        self.undo_stack = []
        self.redo_stack = []

    def load_csv(self, file_content: bytes, filename: str, delimiter: str = ",", has_header: bool = True):
        self.size_bytes = len(file_content)
        self.filename = filename
        
        # Read CSV with Pandas
        na_values = ["", " ", "NA", "N/A", "NaN", "null", "NULL"]
        
        stream = io.BytesIO(file_content)
        if has_header:
            self.df = pd.read_csv(stream, sep=delimiter, na_values=na_values, keep_default_na=True)
        else:
            self.df = pd.read_csv(stream, sep=delimiter, header=None, na_values=na_values, keep_default_na=True)
            self.df.columns = [f"Col{i}" for i in range(self.df.shape[1])]

        # Ensure index column exists
        self.df = self.df.reset_index(drop=True)
        self.df["_rowId"] = self.df.index + 1
        self.columns = [col for col in self.df.columns if col != "_rowId"]
        
        # Optimize numeric columns by downcasting to float32 / int32
        for col in self.columns:
            try:
                # Try to downcast floats or integers
                converted = pd.to_numeric(self.df[col], errors='ignore')
                if converted.dtype.kind in 'iuf':  # integer, unsigned, or float
                    self.df[col] = pd.to_numeric(converted, downcast='float')
            except Exception:
                pass

        self.original_df = self.df.copy()
        
        # Reset logs and history
        self.operations_log = []
        self.undo_stack = []
        self.redo_stack = []
        
        self.infer_column_types()
        self.log_operation("Database Loaded", f"Imported file [{filename}] containing {len(self.df)} rows and {len(self.columns)} columns.", force_reset=True)

    def infer_column_types(self):
        self.column_types = {}
        if self.df is None or self.df.empty:
            return

        for col in self.columns:
            series = self.df[col].dropna()
            if series.empty:
                self.column_types[col] = "Categorical"
                continue
            
            # Subsample for type inference on large datasets
            if len(series) > 20000:
                sample_series = series.sample(n=20000, random_state=42)
            else:
                sample_series = series

            # Check if majority is numeric
            try:
                numeric_converted = pd.to_numeric(sample_series, errors='coerce')
                valid_numeric_pct = numeric_converted.notna().sum() / len(sample_series)
                if valid_numeric_pct > 0.8:
                    self.column_types[col] = "Numeric"
                    continue
            except Exception:
                pass

            # Check if majority is Date
            try:
                date_converted = pd.to_datetime(sample_series, errors='coerce')
                valid_date_pct = date_converted.notna().sum() / len(sample_series)
                if valid_date_pct > 0.8:
                    self.column_types[col] = "Date"
                    continue
            except Exception:
                pass

            self.column_types[col] = "Categorical"

    def log_operation(self, title: str, desc: str, force_reset: bool = False):
        if force_reset:
            self.operations_log = []
        self.operations_log.append({
            "id": len(self.operations_log) + 1,
            "title": title,
            "desc": desc,
            "timestamp": datetime.now().strftime("%I:%M:%S %p")
        })

    def push_undo_state(self):
        row_count = len(self.df) if self.df is not None else 0
        max_stack_size = 25
        if row_count > 200000:
            max_stack_size = 1
        elif row_count > 50000:
            max_stack_size = 3
        elif row_count > 10000:
            max_stack_size = 8

        while len(self.undo_stack) >= max_stack_size:
            self.undo_stack.pop(0)

        self.undo_stack.append({
            "df": self.df.copy(),
            "columns": list(self.columns),
            "column_types": dict(self.column_types)
        })
        self.redo_stack = []

    def undo(self):
        if not self.undo_stack:
            return False
        
        # Save current state to redo stack
        self.redo_stack.append({
            "df": self.df.copy(),
            "columns": list(self.columns),
            "column_types": dict(self.column_types)
        })

        prev = self.undo_stack.pop()
        self.df = prev["df"]
        self.columns = prev["columns"]
        self.column_types = prev["column_types"]
        
        # Pop last operation log
        if self.operations_log:
            self.operations_log.pop()
        return True

    def redo(self):
        if not self.redo_stack:
            return False

        # Save current state to undo stack
        self.undo_stack.append({
            "df": self.df.copy(),
            "columns": list(self.columns),
            "column_types": dict(self.column_types)
        })

        next_state = self.redo_stack.pop()
        self.df = next_state["df"]
        self.columns = next_state["columns"]
        self.column_types = next_state["column_types"]
        self.log_operation("Redo Operation", "Restored previously reverted dataset action.")
        return True

    def reset(self):
        if self.original_df is None:
            return False
        self.push_undo_state()
        self.df = self.original_df.copy()
        self.columns = [col for col in self.df.columns if col != "_rowId"]
        self.infer_column_types()
        self.log_operation("Reset Data Workspace", "Flushed all active cleaning logs and inline cell modifications.", force_reset=True)
        return True

    def get_summary_stats(self):
        if self.df is None:
            return {}
        
        row_count = len(self.df)
        col_count = len(self.columns)
        total_cells = row_count * col_count
        
        missing_count = int(self.df[self.columns].isna().sum().sum())
        missing_ratio = missing_count / total_cells if total_cells > 0 else 0
        
        # Calculate duplicate rows (excluding _rowId)
        dup_count = int(self.df[self.columns].duplicated().sum())
        dup_ratio = dup_count / row_count if row_count > 0 else 0

        # Health score: 100 - (missing_ratio * 150) - (dup_ratio * 200)
        health_score = max(0, min(100, round(100 - (missing_ratio * 150) - (dup_ratio * 200))))

        # RAM estimation
        memory_usage_kb = round(self.df.memory_usage(deep=True).sum() / 1024, 1)

        return {
            "filename": self.filename,
            "rows": row_count,
            "columns": col_count,
            "missing_cells": missing_count,
            "missing_pct": round(missing_ratio * 100, 2),
            "duplicates": dup_count,
            "quality_score": health_score,
            "memory_usage_kb": memory_usage_kb,
            "activity_log": self.operations_log
        }

    def get_profile(self):
        if self.df is None:
            return []

        profile = []
        for col in self.columns:
            series = self.df[col]
            missing_count = int(series.isna().sum())
            missing_pct = round((missing_count / len(self.df)) * 100, 2) if len(self.df) > 0 else 0
            unique_count = int(series.nunique(dropna=True))
            col_type = self.column_types.get(col, "Categorical")

            stats = {
                "name": col,
                "type": col_type,
                "missing_count": missing_count,
                "missing_pct": missing_pct,
                "unique": unique_count,
                "min": "--",
                "max": "--",
                "mean": "--",
                "median": "--",
                "std": "--",
                "variance": "--",
                "skewness": "--",
                "q1": "--",
                "q3": "--"
            }

            if col_type == "Numeric":
                numeric_series = pd.to_numeric(series, errors='coerce').dropna()
                if not numeric_series.empty:
                    stats["min"] = float(numeric_series.min())
                    stats["max"] = float(numeric_series.max())
                    stats["mean"] = float(numeric_series.mean())
                    stats["median"] = float(numeric_series.median())
                    
                    # Optimize heavy calculations for large datasets via random sampling
                    if len(numeric_series) > 50000:
                        sample_series = numeric_series.sample(n=50000, random_state=42)
                    else:
                        sample_series = numeric_series

                    stats["std"] = float(sample_series.std()) if len(sample_series) > 1 else 0.0
                    stats["variance"] = float(sample_series.var()) if len(sample_series) > 1 else 0.0
                    stats["skewness"] = float(sample_series.skew()) if len(sample_series) > 2 else 0.0
                    stats["q1"] = float(sample_series.quantile(0.25))
                    stats["q3"] = float(sample_series.quantile(0.75))

            profile.append(stats)
            
        return profile

    def get_categorical_counts(self, col: str):
        if self.df is None or col not in self.columns:
            return []
        
        series = self.df[col].fillna("[Blank]")
        counts = series.value_counts()
        total = len(self.df)
        
        results = []
        for val, count in counts.items():
            results.append({
                "label": str(val),
                "count": int(count),
                "percentage": round((count / total) * 100, 2) if total > 0 else 0
            })
        return results[:15]  # Limit to top 15 values

    def get_grid(self, page: int = 1, page_size: int = 10, search: str = "", sort_col: str = "", sort_asc: bool = True):
        if self.df is None:
            return {"rows": [], "total": 0, "pages": 0, "columns": []}

        # Work on copy of columns + _rowId
        cols_to_select = ["_rowId"] + self.columns
        filtered_df = self.df[cols_to_select]

        # Apply search if any
        if search:
            search_lower = search.lower()
            # Match any column value containing search string
            mask = np.column_stack([filtered_df[c].astype(str).str.lower().str.contains(search_lower, na=False) for c in self.columns]).any(axis=1)
            filtered_df = filtered_df[mask]

        total_rows = len(filtered_df)

        # Apply sort
        if sort_col and sort_col in self.columns:
            # We sort numerically if numeric type, otherwise lexicographically
            if self.column_types.get(sort_col) == "Numeric":
                sort_series = pd.to_numeric(filtered_df[sort_col], errors='coerce')
                sort_idx = sort_series.argsort().values
                if not sort_asc:
                    sort_idx = sort_idx[::-1]
                filtered_df = filtered_df.iloc[sort_idx]
            else:
                filtered_df = filtered_df.sort_values(by=sort_col, ascending=sort_asc, na_position='last')

        # Pagination
        total_pages = max(1, math.ceil(total_rows / page_size))
        current_page = max(1, min(page, total_pages))
        start_row = (current_page - 1) * page_size
        end_row = min(start_row + page_size, total_rows)

        sliced_df = filtered_df.iloc[start_row:end_row]
        
        # Replace NaN with empty string for JSON serialization
        sliced_df = sliced_df.fillna("")
        rows_list = sliced_df.to_dict(orient="records")

        return {
            "rows": rows_list,
            "total": total_rows,
            "pages": total_pages,
            "columns": self.columns,
            "column_types": self.column_types,
            "start": start_row + 1 if total_rows > 0 else 0,
            "end": end_row,
            "current_page": current_page
        }

    def edit_cell(self, row_id: int, col: str, val: str):
        if self.df is None or col not in self.columns:
            return False

        row_idx = self.df[self.df["_rowId"] == row_id].index
        if len(row_idx) == 0:
            return False

        self.push_undo_state()
        old_val = self.df.loc[row_idx[0], col]
        
        # Standardize empty values
        if val == "" or val == "[NULL]" or val.upper() == "NAN" or val.upper() == "NULL":
            self.df.loc[row_idx[0], col] = np.nan
            logged_val = "[NULL]"
        else:
            # Try to save as numeric if column is numeric
            if self.column_types.get(col) == "Numeric":
                try:
                    self.df.loc[row_idx[0], col] = float(val)
                except ValueError:
                    self.df.loc[row_idx[0], col] = val
            else:
                self.df.loc[row_idx[0], col] = val
            logged_val = val

        self.log_operation("Inline Edit", f"Modified row {row_id} cell \"{col}\" from [{old_val}] to [{logged_val}].")
        return True

    # ----------------------------------------------------
    # Cleaning Operations
    # ----------------------------------------------------

    def remove_duplicates(self):
        if self.df is None:
            return
        self.push_undo_state()
        initial_len = len(self.df)
        self.df = self.df.drop_duplicates(subset=self.columns, keep='first').reset_index(drop=True)
        # Update row IDs to preserve sequence
        self.df["_rowId"] = self.df.index + 1
        removed = initial_len - len(self.df)
        self.log_operation("Purge Duplicates", f"Removed {removed} duplicate records from the dataset rows.")

    def drop_missing(self, col: str):
        if self.df is None or col not in self.columns:
            return
        self.push_undo_state()
        initial_len = len(self.df)
        self.df = self.df.dropna(subset=[col]).reset_index(drop=True)
        self.df["_rowId"] = self.df.index + 1
        removed = initial_len - len(self.df)
        self.log_operation("Null Imputation", f"Dropped {removed} rows containing blank entries in column [{col}].")

    def fill_missing(self, col: str, strategy: str, custom_val: str = ""):
        if self.df is None or col not in self.columns:
            return
        self.push_undo_state()
        
        null_mask = self.df[col].isna()
        null_count = null_mask.sum()
        if null_count == 0:
            return

        if strategy == "mean":
            val = pd.to_numeric(self.df[col], errors='coerce').mean()
            if pd.isna(val):
                return
        elif strategy == "median":
            val = pd.to_numeric(self.df[col], errors='coerce').median()
            if pd.isna(val):
                return
        elif strategy == "mode":
            mode_series = self.df[col].dropna().mode()
            val = mode_series.iloc[0] if not mode_series.empty else ""
        elif strategy == "custom":
            if self.column_types.get(col) == "Numeric":
                try:
                    val = float(custom_val)
                except ValueError:
                    val = custom_val
            else:
                val = custom_val
        else:
            return

        self.df[col] = self.df[col].fillna(val)
        self.log_operation("Null Imputation", f"Replaced {null_count} empty values in column [{col}] with {strategy}: [{val}].")

    def drop_column(self, col: str):
        if self.df is None or col not in self.columns:
            return
        self.push_undo_state()
        self.df = self.df.drop(columns=[col])
        self.columns.remove(col)
        self.column_types.pop(col, None)
        self.log_operation("Drop Column", f"Deleted column [{col}] completely from the dataset grid.")

    def rename_column(self, col: str, new_name: str):
        if self.df is None or col not in self.columns or not new_name or new_name in self.columns:
            return False
        self.push_undo_state()
        self.df = self.df.rename(columns={col: new_name})
        idx = self.columns.index(col)
        self.columns[idx] = new_name
        self.column_types[new_name] = self.column_types.pop(col, "Categorical")
        self.log_operation("Rename Column", f"Renamed column label [{col}] to new header label [{new_name}].")
        return True

    def replace_values(self, col: str, find_val: str, sub_val: str):
        if self.df is None or col not in self.columns:
            return
        self.push_undo_state()
        
        # Handle string and numeric matching
        col_type = self.column_types.get(col)
        if col_type == "Numeric":
            try:
                f_val = float(find_val)
                s_val = float(sub_val) if sub_val != "" else np.nan
            except ValueError:
                f_val = find_val
                s_val = sub_val
        else:
            f_val = find_val
            s_val = sub_val if sub_val != "" else np.nan

        # Count affected
        affected = (self.df[col].astype(str) == str(find_val)).sum()
        self.df[col] = self.df[col].replace(f_val, s_val)
        self.log_operation("Replace Value", f"Substituted all {affected} occurrences of cell entry [{find_val}] with [{sub_val}] in column [{col}].")

    def standardize_strings(self, col: str, operation: str):
        if self.df is None or col not in self.columns:
            return
        self.push_undo_state()
        
        series = self.df[col].astype(str).fillna("")
        if operation == "trim":
            self.df[col] = series.str.strip()
            desc = "trimmed whitespaces"
        elif operation == "upper":
            self.df[col] = series.str.upper()
            desc = "converted to UPPERCASE"
        elif operation == "lower":
            self.df[col] = series.str.lower()
            desc = "converted to lowercase"
        elif operation == "title":
            self.df[col] = series.str.title()
            desc = "converted to Title Case"
        else:
            return

        self.log_operation("String Standardize", f"Successfully formatted columns records in [{col}] using format rule: {desc}.")

    def remove_outliers(self, col: str, multiplier: float = 1.5):
        if self.df is None or col not in self.columns or self.column_types.get(col) != "Numeric":
            return
        self.push_undo_state()
        
        series = pd.to_numeric(self.df[col], errors='coerce')
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        initial_len = len(self.df)
        
        # Keep rows within bounds OR NaN rows (so outlier filtering doesn't implicitly delete nulls)
        mask = (series >= lower_bound) & (series <= upper_bound) | series.isna()
        self.df = self.df[mask].reset_index(drop=True)
        self.df["_rowId"] = self.df.index + 1
        
        removed = initial_len - len(self.df)
        self.log_operation("Outlier Removal", f"Dropped {removed} records from dataset with values in [{col}] outside thresholds: [{round(lower_bound, 2)} - {round(upper_bound, 2)}].")
