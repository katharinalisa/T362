import pandas as pd
import numpy as np

def extract_items_auto(path, sheet_name, max_header_check=5):
 
    for header_row in range(max_header_check):
        try:
            df = pd.read_excel(path, sheet_name=sheet_name, header=header_row)
            if df.shape[1] < 2:
                continue 
            df = df.dropna(how="all")
            cols = [str(c).strip() for c in df.columns]

    
            value_candidates = [c for c in cols if any(x in c.lower() for x in ["$", "value", "amount", "balance"])]
            value_col = value_candidates[0] if value_candidates else cols[-1]

            
            label_candidates = [c for c in cols if c != value_col]
            label_col = label_candidates[0] if label_candidates else cols[0]

            items, total = [], 0
            for _, row in df.iterrows():
                label = row[label_col]
                value = row[value_col]

                if pd.isna(label) or pd.isna(value):
                    continue

                label_str = str(label).strip()
                if label_str.lower().startswith("total"):
                    continue 
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    continue

                items.append({"label": label_str, "value": value})
                total += value

            if items:
                print(f"{sheet_name}: header_row={header_row}, label_col='{label_col}', value_col='{value_col}'")
                return items, total

        except Exception as e:
            continue

    print(f"⚠️ Could not parse {sheet_name}")
    return [], 0


def find_sheet(sheets, keywords):
    """Find sheet by matching keywords in its name (case-insensitive)."""
    for name in sheets:
        lname = name.lower().strip()
        if any(k in lname for k in keywords):
            print(f"Found sheet: {name} (matched {keywords})")
            return name
    print(f"No sheet found for {keywords}")
    return None


def parse_excel(path):
    sheets = pd.ExcelFile(path).sheet_names
    print(f"\nParsing Excel file: {path}")
    print(f"Sheets found: {sheets}\n")

    # --- Assets ---
    assets_name = find_sheet(sheets, ["asset"])
    assets_items, assets_total = extract_items_auto(path, assets_name) if assets_name else ([], 0)

    # --- Liabilities ---
    liab_name = find_sheet(sheets, ["liab", "debt", "loan", "mortgage"])
    liab_items, liab_total = extract_items_auto(path, liab_name) if liab_name else ([], 0)

    net_worth = assets_total - liab_total
    print(f"Net Worth = {net_worth}\n")

    # --- Expenses ---
    exp_name = find_sheet(sheets, ["expense", "spending"])
    exp_items, exp_total = extract_items_auto(path, exp_name) if exp_name else ([], 0)

    # --- Subscriptions ---
    subs_name = find_sheet(sheets, ["subs", "subscription", "services"])
    subs_items, subs_total = extract_items_auto(path, subs_name) if subs_name else ([], 0)

    # Merge subscriptions into expenses
    exp_total += subs_total
    exp_items.extend(subs_items)

    # --- Income ---
    inc_name = find_sheet(sheets, ["income", "salary", "earnings"])
    inc_items, inc_total = extract_items_auto(path, inc_name) if inc_name else ([], 0)
    if inc_total == 0:
        inc_total = 5000
        print("No income found, using fallback=5000")
    monthly_savings = max(0, inc_total - exp_total)
    print(f"Monthly Savings = {monthly_savings}\n")

    # --- Emergency Fund ---
    ef_name = find_sheet(sheets, ["emergency"])
    ef_goal, ef_current = 0, 0
    if ef_name:
        df = pd.read_excel(path, sheet_name=ef_name)
        try:
            ef_goal = float(df.iloc[0, 1])
            ef_current = float(df.iloc[1, 1])
            print(f"Emergency Fund: goal={ef_goal}, current={ef_current}")
        except Exception:
            print("Could not parse Emergency Fund sheet")

    # --- Superannuation Growth ---
    super_name = find_sheet(sheets, ["super"])
    if super_name:
        df = pd.read_excel(path, sheet_name=super_name)
        super_years = list(df.iloc[:, 0].dropna())
        super_values = list(df.iloc[:, 1].dropna())
    else:
        super_years = list(range(2025, 2035))
        super_values = [10000 * (1.05**i) for i in range(len(super_years))]
    print(f"Superannuation Growth: {len(super_years)} years\n")

    # --- Savings Over Time ---
    months = list(range(0, 12 * 10 + 1))
    rate_monthly = 0.03 / 12
    balance, savings_values = 0, []
    for m in months:
        if m > 0:
            balance = balance * (1 + rate_monthly) + monthly_savings
        savings_values.append(round(balance, 2))

    # --- Drawdown Over Time ---
    drawdown_months = months
    retirement_balance = super_values[-1] if super_values else 200000
    withdrawal, bal, drawdown_values = 3000, retirement_balance, []
    for _ in drawdown_months:
        bal = bal * (1 + rate_monthly) - withdrawal
        drawdown_values.append(max(0, round(bal, 2)))

    print("Finished parsing Excel\n")

    return {
        "net_worth": net_worth,
        "assets": {"total": assets_total, "items": assets_items},
        "liabilities": {"total": liab_total, "items": liab_items},
        "monthly_savings": monthly_savings,
        "expenses": {"total": exp_total, "items": exp_items},
        "subscriptions": {"total": subs_total, "items": subs_items},
        "income": {"total": inc_total, "items": inc_items},
        "emergency_fund": {"goal": ef_goal, "current": ef_current},
        "super": {"years": super_years, "values": super_values},
        "savings_over_time": {"months": months, "values": savings_values},
        "drawdown_over_time": {"months": drawdown_months, "values": drawdown_values},
    }
