# 🧠 TaskMatrix — Smart Priority Engine

> **Multi-Criteria Decision-Making (MCDM) Model for Task Optimization**
> A To-Do list that doesn't just list tasks — it *ranks* them using a Weighted Decision Matrix with Fuzzy Logic scoring.

---

## 🚀 Live Demo

Open `index.html` directly in your browser — no server or build step required.

---

## 🎯 What It Does

TaskMatrix uses an **MCDM (Multi-Criteria Decision-Making)** algorithm to automatically rank your tasks by calculating a **Priority Score** based on four weighted criteria:

```
SCORE = w₁×Urgency + w₂×Impact + w₃×Ease + w₄×Deadline
```

All criteria are normalized to `[0, 1]` using a **Fuzzy S-curve** (Hermite interpolation) before weighting, so extreme inputs are smoothed rather than linearly extrapolated.

---

## 🧮 Algorithm Details

### Fuzzy S-Curve Normalization
Each raw input `x ∈ [1, 10]` is passed through:
```
n = (x - min) / (max - min)       // linear normalize
fuzzy(n) = 3n² - 2n³              // Hermite smooth-step
```
This gives a sigmoid-like curve that avoids hard jumps at boundaries.

### Deadline Score
Days remaining → urgency score mapping:
| Days Left | Deadline Score |
|-----------|---------------|
| Overdue   | 1.00          |
| Today     | 0.95          |
| ≤ 3 days  | 0.85          |
| ≤ 7 days  | 0.70          |
| ≤ 14 days | 0.50          |
| ≤ 30 days | 0.25          |
| > 30 days | 0.10          |

### Priority Tiers
| Score Range | Tier     |
|-------------|----------|
| ≥ 72        | 🔴 Critical |
| 50–71       | 🟠 High     |
| 28–49       | 🟣 Medium   |
| < 28        | 🟢 Low      |

### Eisenhower Matrix
Tasks are also classified into quadrants:
- **Q1 Do First** — High Urgency + High Impact
- **Q2 Schedule** — Low Urgency + High Impact
- **Q3 Delegate** — High Urgency + Low Impact
- **Q4 Eliminate** — Low Urgency + Low Impact

---

## 🛠 Technologies Used

| Layer       | Technology |
|-------------|------------|
| Structure   | **HTML5** (semantic markup) |
| Styling     | **CSS3** (custom properties, grid, flexbox, animations) |
| Logic       | **Vanilla JavaScript ES6+** (no frameworks, no dependencies) |
| Fonts       | **Google Fonts** — Syne + JetBrains Mono |
| Storage     | **localStorage** (tasks + weights persist across sessions) |
| Algorithm   | **MCDM** — Weighted Decision Matrix + Fuzzy Logic |

> ✅ Zero build tools. Zero npm. Zero frameworks. Pure HTML/CSS/JS.

---

## 📁 Project Structure

```
smart-task-prioritizer/
├── index.html          ← App shell & UI structure
├── src/
   ├── style.css       ← All styles, themes, animations
   └── app.js          ← MCDM engine + full app logic

```

---

## ✨ Features

- ✅ **Auto-ranked task list** — reorders instantly on any change
- ✅ **Adjustable weights** — tune MCDM criteria live
- ✅ **Fuzzy Logic scoring** — smooth S-curve normalization
- ✅ **Eisenhower Matrix** visualization
- ✅ **4 Priority tiers** — Critical / High / Medium / Low
- ✅ **Deadline countdown** — smart relative labels
- ✅ **Filter & hide** — by category, priority, done status
- ✅ **LocalStorage persistence** — survives page refresh
- ✅ **JSON Export** — download your scored task list
- ✅ **Live stats dashboard** — total, critical, done, avg score
- ✅ **Fully responsive** — works on mobile



