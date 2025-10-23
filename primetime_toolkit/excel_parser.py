import pandas as pd
import numpy as np
from collections import defaultdict

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

            freq_candidates = [c for c in cols if any(x in c.lower() for x in ["freq", "frequency"])]
            freq_col = freq_candidates[0] if freq_candidates else None

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


def extract_total_assets(path, sheet_name):
    df = pd.read_excel(path, sheet_name=sheet_name)
    for _, row in df.iterrows():
        label = str(row[0]).strip().lower()
        if "total assets" in label or "assets total" in label:
            try:
                return float(row[1])
            except:
                continue
    return None


def extract_net_worth(path, sheet_name):
    df = pd.read_excel(path, sheet_name=sheet_name)
    for _, row in df.iterrows():
        label = str(row[0]).strip().lower()
        if "net worth" in label:
            try:
                return float(row[1])
            except:
                continue
    return None


def parse_excel(path):
    sheets = pd.ExcelFile(path).sheet_names
    print(f"\nParsing Excel file: {path}")
    print(f"Sheets found: {sheets}\n")

    # --- Assets ---
    assets_name = find_sheet(sheets, ["asset"])
    explicit_assets_total = extract_total_assets(path, assets_name) if assets_name else None
    assets_items, calculated_assets_total = extract_items_auto(path, assets_name) if assets_name else ([], 0)
    assets_total = explicit_assets_total if explicit_assets_total is not None else calculated_assets_total

    # --- Liabilities ---
    liab_name = find_sheet(sheets, ["liab", "debt", "loan", "mortgage"])
    liab_items, liab_total = extract_items_auto(path, liab_name) if liab_name else ([], 0)

    # --- Net Worth (explicit override if available) ---
    nw_sheet = find_sheet(sheets, ["summary", "overview", "net worth"])
    explicit_net_worth = extract_net_worth(path, nw_sheet) if nw_sheet else None
    net_worth = explicit_net_worth if explicit_net_worth is not None else assets_total - liab_total

    print(f"Net Worth = {net_worth}\n")

    frequency_map = defaultdict(lambda: 12, {
        "weekly": 52,
        "fortnightly": 26,
        "monthly": 12,
        "quarterly": 4,
        "annually": 1,
        "yearly": 1,
        "daily": 365,
    })

    # --- Expenses ---
    exp_name = find_sheet(sheets, ["expense", "spending"])
    exp_items, exp_total = extract_items_auto(path, exp_name) if exp_name else ([], 0)

    expense_buckets_sum = defaultdict(float)
    for item in exp_items:
        label = (item.get("label") or "Other").strip().title()
        value = float(item.get("value") or 0.0)
        expense_buckets_sum[label] += value

    
    # --- Subscriptions ---
    subs_name = find_sheet(sheets, ["subs", "subscription", "services"])
    subs_items, subs_total = extract_items_auto(path, subs_name) if subs_name else ([], 0)

    grouped_subs = defaultdict(float)
    for item in subs_items:
        label = (item.get("label") or "Other").strip().title()
        value = float(item.get("value") or 0.0)
        grouped_subs[label] += value
    
    subs_breakdown = [
        {"label": lbl, "value": round(val, 2)} for lbl, val in grouped_subs.items()
    ]

    # Merge subscriptions into expenses
    exp_total += subs_total
    exp_items.extend(subs_items)

    # --- Income ---
    inc_name = find_sheet(sheets, ["income", "salary", "earnings"])
    inc_items, inc_total = extract_items_auto(path, inc_name) if inc_name else ([], 0)
    if inc_total == 0:
        inc_total = 5000
        print("No income found, using fallback=5000")

    grouped_incomes = defaultdict(float)
    for item in inc_items:
        label = (item.get("label") or "Other").strip().title()
        value = float(item.get("value") or 0.0)
        grouped_incomes[label] += value
    
    income_breakdown = [
        {"label": lbl, "value": round(val, 2)} for lbl, val in grouped_incomes.items()
    ]

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
        "expenses": {"total": exp_total, "items": exp_items, "buckets_sum": expense_buckets_sum},
        "subscriptions": {"total": subs_total, "items": subs_items, "breakdown": subs_breakdown},
        "income": {"total": inc_total, "items": inc_items, "breakdown": income_breakdown},
        "emergency_fund": {"goal": ef_goal, "current": ef_current},
        "super": {"years": super_years, "values": super_values},
        "savings_over_time": {"months": months, "values": savings_values},
        "drawdown_over_time": {"months": drawdown_months, "values": drawdown_values},
    }
