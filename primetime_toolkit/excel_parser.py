import pandas as pd
import numpy as np

def find_sheet(sheets, keywords):
        for name in sheets:
            lname = name.lower().strip()
            if any(k in lname for k in keywords):
                return sheets[name]
        return None

def extract_items(df, label_col=0):
    items, total = [], 0
    if df is None or df.empty:
        return items, 0
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return items, 0
    for _, row in df.iterrows():
        label = str(row.iloc[label_col]).strip() if pd.notna(row.iloc[label_col]) else ""
        value = None
        for nc in numeric_cols:
            v = row[nc]
            if pd.notna(v) and isinstance(v, (int, float, np.number)):
                value = float(v)
                break
        if label and value:
            items.append({"label": label, "value": value})
            total += value
    return items, total

def parse_excel(path):

    sheets = pd.read_excel(path, sheet_name=None, engine="openpyxl")

    # --- Assets ---
    assets_df = find_sheet(sheets, ["asset"])
    assets_items, assets_total = extract_items(assets_df)

    # --- Liabilities ---
    liabilities_df = find_sheet(sheets, ["liab", "debt", "loan", "mortgage"])
    liab_items, liab_total = extract_items(liabilities_df)

    net_worth = assets_total - liab_total

    # --- Expenses ---
    expenses_df = find_sheet(sheets, ["expense", "spending"])
    exp_items, exp_total = extract_items(expenses_df)

     # --- Subscriptions ---
    subs_df = find_sheet(sheets, ["subs", "subscription", "services"])
    subs_items, subs_total = extract_items(subs_df)

     # --- Income ---
    income_df = find_sheet(sheets, ["income", "salary", "earnings"])
    inc_items, inc_total = extract_items(income_df)

    if inc_total == 0:  # fallback
        inc_total = 5000

    monthly_savings = max(0, inc_total - exp_total)

    # --- Emergency Fund ---
    ef_df = find_sheet(sheets, ["emergency"])
    ef_goal, ef_current = 0, 0
    if ef_df is not None and not ef_df.empty:
        try:
            ef_goal = float(ef_df.iloc[0,1])
            ef_current = float(ef_df.iloc[1,1])
        except Exception:
            pass

    # --- Super Projection ---
    super_df = find_sheet(sheets, ["super"])
    if super_df is not None and not super_df.empty:
        super_years = list(super_df.iloc[:,0].dropna())
        super_values = list(super_df.iloc[:,1].dropna())
    else:
        super_years = list(range(2025, 2035))
        super_values = [10000 * (1.05**i) for i in range(len(super_years))]

    # --- Savings Over Time (10 years projection) ---
    months = list(range(0, 12*10+1))
    rate_annual, rate_monthly = 0.03, 0.03/12
    balance, savings_values = 0, []
    for m in months:
        if m > 0:
            balance = balance*(1+rate_monthly) + monthly_savings
        savings_values.append(round(balance,2))

    # --- Drawdown Over Time ---
    drawdown_months = months
    retirement_balance = super_values[-1] if super_values else 200000
    withdrawal, bal, drawdown_values = 3000, retirement_balance, []
    for _ in drawdown_months:
        bal = bal*(1+rate_monthly) - withdrawal
        drawdown_values.append(max(0, round(bal,2)))

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
    

