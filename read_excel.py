import pandas as pd
import sys

try:
    file = 'CRM_Normalizado_v6.xlsx'
    xl = pd.ExcelFile(file)
    print("Excel extracted successfully.\n")
    for sheet in xl.sheet_names:
        print(f"--- Sheet: {sheet} ---")
        df = xl.parse(sheet)
        print(f"Columns: {', '.join(df.columns)}")
        print(f"Rows: {len(df)}")
        print()
except Exception as e:
    print(f"Error reading excel: {e}")
