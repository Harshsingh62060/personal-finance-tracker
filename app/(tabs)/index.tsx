import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { BarChart, PieChart } from "react-native-chart-kit";

type TransactionType = "income" | "expense";
type ToastType = "error" | "success";
type ThemeMode = "light" | "dark" | "system";

type FilterType =
  | "all"
  | "thisWeek"
  | "lastWeek"
  | "lastMonth"
  | "last3Months"
  | "custom";

type Transaction = {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  createdAt: string;
};

type MonthlySummaryItem = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
};

type CategorySummaryItem = {
  category: string;
  total: number;
};

const STORAGE_KEY = "finance_transactions";
const THEME_KEY = "finance_theme_preference";

const incomeCategories = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Others",
];

const expenseCategories = [
  "Food",
  "Transport",
  "Entertainment",
  "Shopping",
  "Bills",
  "Health",
  "Education",
  "Others",
];

const screenWidth = Dimensions.get("window").width;
const chartWidth = Math.max(screenWidth - 72, 280);

const chartColors = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const lightTheme = {
  background: "#f8fafc",
  backgroundDeep: "#e2e8f0",
  card: "#ffffff",
  cardSecondary: "#f1f5f9",
  border: "#dbe4ee",
  text: "#0f172a",
  textSoft: "#475569",
  textMuted: "#64748b",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  purple: "#9333ea",
  cyan: "#0891b2",
  badge: "#e2e8f0",
  inputBg: "#ffffff",
  pickerBg: "#f8fafc",
  toastSuccessBg: "#14532d",
  toastSuccessBorder: "#4ade80",
  toastErrorBg: "#7f1d1d",
  toastErrorBorder: "#f87171",
  deleteBg: "#b91c1c",
  hero: "#eef4ff",
  shadow: "#94a3b8",
};

const darkTheme = {
  background: "#020b26",
  backgroundDeep: "#06122f",
  card: "#13213f",
  cardSecondary: "#0f172a",
  border: "#22365f",
  text: "#ffffff",
  textSoft: "#cbd5e1",
  textMuted: "#94a3b8",
  blue: "#60a5fa",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#c084fc",
  cyan: "#22d3ee",
  badge: "#1e3a5f",
  inputBg: "#0f172a",
  pickerBg: "#f8fafc",
  toastSuccessBg: "#14532d",
  toastSuccessBorder: "#4ade80",
  toastErrorBg: "#7f1d1d",
  toastErrorBorder: "#f87171",
  deleteBg: "#7f1d1d",
  hero: "#0f1b3d",
  shadow: "#000000",
};

const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getStartOfDay(d);
};

const getEndOfWeek = (date: Date) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return getEndOfDay(end);
};

const getStartOfMonth = (date: Date) =>
  getStartOfDay(new Date(date.getFullYear(), date.getMonth(), 1));

const getEndOfMonth = (date: Date) =>
  getEndOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

const isDateInRange = (date: Date, start: Date, end: Date) =>
  date >= start && date <= end;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);

const getGreetingMessage = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getMotivationMessage = () => {
  const messages = [
    "Your money story gets clearer with every entry.",
    "Small financial habits build strong futures.",
    "Track today, stay confident tomorrow.",
    "A little awareness creates a lot of control.",
  ];
  return messages[new Date().getDate() % messages.length];
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    Salary: "💼",
    Freelance: "🧑‍💻",
    Business: "🏢",
    Investment: "📈",
    Gift: "🎁",
    Food: "🍔",
    Transport: "🚕",
    Entertainment: "🎬",
    Shopping: "🛍️",
    Bills: "🧾",
    Health: "💊",
    Education: "📚",
    Others: "✨",
  };
  return icons[category] || "💰";
};

function AnimatedProgressBar({
  percentage,
  color,
  trackColor,
}: {
  percentage: number;
  color: string;
  trackColor: string;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: percentage,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percentage, animatedValue]);

  const widthInterpolated = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: color,
            width: widthInterpolated,
          },
        ]}
      />
    </View>
  );
}

export default function HomeScreen() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const theme =
    themeMode === "system"
      ? systemScheme === "light"
        ? lightTheme
        : darkTheme
      : themeMode === "light"
      ? lightTheme
      : darkTheme;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("error");

  const toastTranslateY = useRef(new Animated.Value(-120)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTransactions();
    loadThemePreference();
  }, []);

  useEffect(() => {
    saveTransactions();
  }, [transactions]);

  useEffect(() => {
    saveThemePreference();
  }, [themeMode]);

  const categoryOptions =
    transactionType === "income" ? incomeCategories : expenseCategories;

  const allTimeStats = useMemo(() => {
    let balance = 0;
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach((item) => {
      if (item.type === "income") {
        totalIncome += item.amount;
        balance += item.amount;
      } else {
        totalExpense += item.amount;
        balance -= item.amount;
      }
    });

    return {
      balance,
      totalExpense,
      totalIncome,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedFilter !== "custom" && transactions.length === 0) {
      return [];
    }

    const now = new Date();

    if (selectedFilter === "all") return transactions;

    let startDate: Date;
    let endDate: Date;

    if (selectedFilter === "thisWeek") {
      startDate = getStartOfWeek(now);
      endDate = getEndOfWeek(now);
    } else if (selectedFilter === "lastWeek") {
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 7);
      startDate = getStartOfWeek(lastWeekDate);
      endDate = getEndOfWeek(lastWeekDate);
    } else if (selectedFilter === "lastMonth") {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = getStartOfMonth(lastMonthDate);
      endDate = getEndOfMonth(lastMonthDate);
    } else if (selectedFilter === "last3Months") {
      const threeMonthsBack = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      startDate = getStartOfMonth(threeMonthsBack);
      endDate = getEndOfMonth(now);
    } else {
      startDate = getStartOfDay(customStartDate);
      endDate = getEndOfDay(customEndDate);
    }

    return transactions.filter((item) => {
      const transactionDate = new Date(item.createdAt);
      return isDateInRange(transactionDate, startDate, endDate);
    });
  }, [transactions, selectedFilter, customStartDate, customEndDate]);

  const analytics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let balance = 0;

    const monthlyMap: Record<string, MonthlySummaryItem> = {};
    const incomeCategoryMap: Record<string, number> = {};
    const expenseCategoryMap: Record<string, number> = {};

    filteredTransactions.forEach((item) => {
      const date = new Date(item.createdAt);

      if (item.type === "income") {
        totalIncome += item.amount;
        balance += item.amount;
        incomeCategoryMap[item.category] =
          (incomeCategoryMap[item.category] || 0) + item.amount;
      } else {
        totalExpense += item.amount;
        balance -= item.amount;
        expenseCategoryMap[item.category] =
          (expenseCategoryMap[item.category] || 0) + item.amount;
      }

      const year = date.getFullYear();
      const month = date.getMonth();
      const paddedMonth = String(month + 1).padStart(2, "0");
      const monthKey = `${year}-${paddedMonth}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          monthKey,
          label: date.toLocaleString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          income: 0,
          expense: 0,
        };
      }

      if (item.type === "income") {
        monthlyMap[monthKey].income += item.amount;
      } else {
        monthlyMap[monthKey].expense += item.amount;
      }
    });

    const monthlySummary = Object.values(monthlyMap).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );

    const incomeByCategory: CategorySummaryItem[] = Object.entries(
      incomeCategoryMap
    )
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const expenseByCategory: CategorySummaryItem[] = Object.entries(
      expenseCategoryMap
    )
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const savingsRate =
      totalIncome <= 0
        ? 0
        : Math.max(
            0,
            Math.min(
              100,
              Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1))
            )
          );

    return {
      totalIncome,
      totalExpense,
      balance,
      monthlySummary,
      incomeByCategory,
      expenseByCategory,
      savingsRate,
    };
  }, [filteredTransactions]);

  const pieChartData = useMemo(() => {
    return analytics.expenseByCategory.map((item, index) => ({
      name: item.category,
      population: item.total,
      color: chartColors[index % chartColors.length],
      legendFontColor: theme.text,
      legendFontSize: 12,
    }));
  }, [analytics.expenseByCategory, theme.text]);

  const monthlyExpenseChartData = useMemo(() => {
    const lastSixMonths = analytics.monthlySummary.slice(-6);

    return {
      labels: lastSixMonths.map((item) => item.label),
      datasets: [
        {
          data:
            lastSixMonths.length > 0
              ? lastSixMonths.map((item) => item.expense)
              : [0],
        },
      ],
    };
  }, [analytics.monthlySummary]);

  const expenseTotalForPercentage = useMemo(() => {
    return analytics.expenseByCategory.reduce((sum, item) => sum + item.total, 0);
  }, [analytics.expenseByCategory]);

  const showToast = (message: string, type: ToastType) => {
    setToastMessage(message);
    setToastType(type);

    toastTranslateY.setValue(-120);
    toastOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastTranslateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2200),
      Animated.parallel([
        Animated.timing(toastTranslateY, {
          toValue: -120,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const loadTransactions = async () => {
    try {
      const savedTransactions = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTransactions) {
        setTransactions(JSON.parse(savedTransactions));
      }
    } catch (error) {
      console.log("Error loading transactions:", error);
    }
  };

  const saveTransactions = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (error) {
      console.log("Error saving transactions:", error);
    }
  };

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system"
      ) {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.log("Error loading theme:", error);
    }
  };

  const saveThemePreference = async () => {
    try {
      await AsyncStorage.setItem(THEME_KEY, themeMode);
    } catch (error) {
      console.log("Error saving theme:", error);
    }
  };

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString("en-IN");

  const formatOnlyDate = (date: Date) => date.toLocaleDateString("en-IN");

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setSelectedCategory("");
    setOtherCategory("");
    setEditingId(null);
    setTransactionType("expense");
  };

  const validateTransaction = () => {
    const numericAmount = Number(amount);
    const finalCategory =
      selectedCategory === "Others" ? otherCategory.trim() : selectedCategory;

    if (!description.trim() || !amount.trim() || !selectedCategory) {
      showToast("Please fill all fields before saving.", "error");
      return null;
    }

    if (selectedCategory === "Others" && !otherCategory.trim()) {
      showToast("Please enter your custom category name.", "error");
      return null;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Amount must be a valid positive number.", "error");
      return null;
    }

    return {
      numericAmount,
      finalCategory,
      finalDescription: description.trim(),
    };
  };

  const addOrUpdateTransaction = () => {
    const validated = validateTransaction();
    if (!validated) return;

    const { numericAmount, finalCategory, finalDescription } = validated;

    if (editingId) {
      const updatedTransactions = transactions.map((item) =>
        item.id === editingId
          ? {
              ...item,
              type: transactionType,
              description: finalDescription,
              amount: numericAmount,
              category: finalCategory,
            }
          : item
      );

      setTransactions(updatedTransactions);
      resetForm();
      showToast("Transaction updated successfully.", "success");
      return;
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: transactionType,
      description: finalDescription,
      amount: numericAmount,
      category: finalCategory,
      createdAt: new Date().toISOString(),
    };

    setTransactions([newTransaction, ...transactions]);
    resetForm();
    showToast("Transaction added successfully.", "success");
  };

  const editTransaction = (item: Transaction) => {
    setEditingId(item.id);
    setTransactionType(item.type);
    setDescription(item.description);
    setAmount(String(item.amount));

    const predefinedList =
      item.type === "income" ? incomeCategories : expenseCategories;

    if (predefinedList.includes(item.category)) {
      setSelectedCategory(item.category);
      setOtherCategory("");
    } else {
      setSelectedCategory("Others");
      setOtherCategory(item.category);
    }

    showToast("Transaction loaded for editing.", "success");
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((item) => item.id !== id));

    if (editingId === id) {
      resetForm();
    }

    showToast("Transaction deleted successfully.", "success");
  };

  const validateCustomDateRange = () => {
    if (selectedFilter === "custom" && customStartDate > customEndDate) {
      showToast("Start date cannot be after end date.", "error");
      return false;
    }
    return true;
  };

  const escapeCsvField = (value: string | number) => {
    return `"${String(value).replace(/"/g, '""')}"`;
  };

  const exportToCSV = async () => {
    try {
      if (!validateCustomDateRange()) return;

      if (filteredTransactions.length === 0) {
        showToast("No transactions available to export.", "error");
        return;
      }

      const csvHeader = "ID,Type,Description,Amount,Category,Created At\n";
      const csvRows = filteredTransactions
        .map((item) =>
          [
            escapeCsvField(item.id),
            escapeCsvField(item.type),
            escapeCsvField(item.description),
            escapeCsvField(item.amount),
            escapeCsvField(item.category),
            escapeCsvField(item.createdAt),
          ].join(",")
        )
        .join("\n");

      const csvContent = csvHeader + csvRows;
      const fileUri =
        FileSystem.documentDirectory +
        `personal-finance-report-${Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export CSV",
          UTI: "public.comma-separated-values-text",
        });
      }

      showToast("CSV exported successfully.", "success");
    } catch (error) {
      console.log(error);
      showToast("CSV export failed.", "error");
    }
  };

  const exportToPDF = async () => {
    try {
      if (!validateCustomDateRange()) return;

      if (filteredTransactions.length === 0) {
        showToast("No transactions available to export.", "error");
        return;
      }

      const rowsHtml = filteredTransactions
        .map(
          (item) => `
            <tr>
              <td>${item.type}</td>
              <td>${item.description}</td>
              <td>₹${formatCurrency(item.amount)}</td>
              <td>${item.category}</td>
              <td>${new Date(item.createdAt).toLocaleString("en-IN")}</td>
            </tr>
          `
        )
        .join("");

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body {
                font-family: Helvetica, Arial, sans-serif;
                padding: 24px;
                color: #0f172a;
              }
              h1 {
                text-align: center;
                margin-bottom: 6px;
              }
              p {
                text-align: center;
                color: #475569;
                margin-top: 0;
                margin-bottom: 24px;
              }
              .summary {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
              }
              .box {
                flex: 1;
                background: #f1f5f9;
                border-radius: 12px;
                padding: 12px;
              }
              .label {
                font-size: 12px;
                color: #64748b;
                margin-bottom: 4px;
              }
              .value {
                font-size: 18px;
                font-weight: bold;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid #cbd5e1;
                padding: 10px;
                text-align: left;
                font-size: 12px;
              }
              th {
                background: #e2e8f0;
              }
            </style>
          </head>
          <body>
            <h1>Personal Finance Tracker</h1>
            <p>Filtered financial report</p>

            <div class="summary">
              <div class="box">
                <div class="label">Balance</div>
                <div class="value">₹${formatCurrency(analytics.balance)}</div>
              </div>
              <div class="box">
                <div class="label">Total Expense</div>
                <div class="value">₹${formatCurrency(analytics.totalExpense)}</div>
              </div>
              <div class="box">
                <div class="label">Transactions</div>
                <div class="value">${filteredTransactions.length}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          UTI: ".pdf",
          mimeType: "application/pdf",
        });
      }

      showToast("PDF exported successfully.", "success");
    } catch (error) {
      console.log(error);
      showToast("PDF export failed.", "error");
    }
  };

  const appliedBalance =
    selectedFilter === "all" ? allTimeStats.balance : analytics.balance;
  const appliedExpense =
    selectedFilter === "all" ? allTimeStats.totalExpense : analytics.totalExpense;
  const appliedIncome =
    selectedFilter === "all" ? allTimeStats.totalIncome : analytics.totalIncome;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Animated.View
        style={[
          styles.toastWrapper,
          {
            backgroundColor:
              toastType === "error"
                ? theme.toastErrorBg
                : theme.toastSuccessBg,
            borderColor:
              toastType === "error"
                ? theme.toastErrorBorder
                : theme.toastSuccessBorder,
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
          },
        ]}
      >
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require("../../assets/images/pft_logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.topHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { color: theme.text }]}>
              Personal Finance Tracker
            </Text>
            <Text style={[styles.appSubHeading, { color: theme.textMuted }]}>
              Premium dashboard experience
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.themeToggleButton,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => {
              if (themeMode === "system") setThemeMode("light");
              else if (themeMode === "light") setThemeMode("dark");
              else setThemeMode("system");
            }}
          >
            <Text style={styles.themeToggleText}>
              {themeMode === "system"
                ? "🌓"
                : themeMode === "light"
                ? "🌞"
                : "🌙"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.greetingCard,
            { backgroundColor: theme.hero, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.greetingTitle, { color: theme.text }]}>
            {getGreetingMessage()}, welcome back 👋
          </Text>
          <Text style={[styles.greetingSubtitle, { color: theme.textSoft }]}>
            {getMotivationMessage()}
          </Text>
        </View>

        <View
          style={[
            styles.heroInsightCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.heroInsightTop}>
            <Text style={[styles.heroInsightTitle, { color: theme.text }]}>
              Today’s finance mood
            </Text>
            <Text style={styles.heroInsightEmoji}>🌟</Text>
          </View>
          <Text style={[styles.heroInsightText, { color: theme.textSoft }]}>
            Keep adding clean entries and your dashboard will become smarter,
            more visual, and more useful every day.
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View
            style={[
              styles.topCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={styles.cardIcon}>💰</Text>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
              Current Balance
            </Text>
            <Text style={[styles.balance, { color: theme.green }]}>
              ₹{formatCurrency(appliedBalance)}
            </Text>
          </View>

          <View
            style={[
              styles.topCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={styles.cardIcon}>📉</Text>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
              Total Expense
            </Text>
            <Text style={[styles.expense, { color: theme.red }]}>
              ₹{formatCurrency(appliedExpense)}
            </Text>
          </View>

          <View
            style={[
              styles.topCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={styles.cardIcon}>📈</Text>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
              Total Income
            </Text>
            <Text style={[styles.incomeText, { color: theme.blue }]}>
              ₹{formatCurrency(appliedIncome)}
            </Text>
          </View>

          <View
            style={[
              styles.topCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={styles.cardIcon}>🛡️</Text>
            <Text style={[styles.cardLabel, { color: theme.textMuted }]}>
              Savings Rate
            </Text>
            <Text style={[styles.savingsText, { color: theme.purple }]}>
              {analytics.savingsRate}%
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {editingId ? "Edit Transaction" : "Add Transaction"}
          </Text>

          <View style={styles.typeSwitchRow}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    transactionType === "income"
                      ? theme.green
                      : theme.cardSecondary,
                },
              ]}
              onPress={() => {
                setTransactionType("income");
                setSelectedCategory("");
                setOtherCategory("");
              }}
            >
              <Text style={styles.buttonText}>Income</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    transactionType === "expense"
                      ? theme.red
                      : theme.cardSecondary,
                },
              ]}
              onPress={() => {
                setTransactionType("expense");
                setSelectedCategory("");
                setOtherCategory("");
              }}
            >
              <Text style={styles.buttonText}>Expense</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: theme.textSoft }]}>
            Description
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Example: Salary for April / Dinner with friends"
            placeholderTextColor={theme.textMuted}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={[styles.inputLabel, { color: theme.textSoft }]}>
            Choose Category
          </Text>

          <View
            style={[
              styles.categorySelectCard,
              {
                backgroundColor: theme.cardSecondary,
                borderColor: theme.cyan,
              },
            ]}
          >
            <View style={styles.categorySelectHeader}>
              <Text style={styles.categorySelectEmoji}>🗂️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.categorySelectTitle, { color: theme.text }]}>
                  Pick a category
                </Text>
                <Text
                  style={[
                    styles.categorySelectSubtitle,
                    { color: theme.textMuted },
                  ]}
                >
                  Cleaner categories make charts and analytics look better.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.pickerWrapperLarge,
                { backgroundColor: theme.pickerBg },
              ]}
            >
              <Picker
                selectedValue={selectedCategory}
                onValueChange={(itemValue) => setSelectedCategory(itemValue)}
                dropdownIconColor="#0f172a"
                style={styles.picker}
              >
                <Picker.Item label="Tap here to select category" value="" />
                {categoryOptions.map((item) => (
                  <Picker.Item key={item} label={item} value={item} />
                ))}
              </Picker>
            </View>
          </View>

          {selectedCategory === "Others" && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Example: Rent / Medicine / Bonus"
              placeholderTextColor={theme.textMuted}
              value={otherCategory}
              onChangeText={setOtherCategory}
            />
          )}

          <Text style={[styles.inputLabel, { color: theme.textSoft }]}>
            Amount
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Example: 2500"
            placeholderTextColor={theme.textMuted}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <TouchableOpacity
            style={[
              styles.primarySaveButton,
              {
                backgroundColor:
                  transactionType === "income" ? theme.green : theme.red,
              },
            ]}
            onPress={addOrUpdateTransaction}
          >
            <Text style={styles.buttonText}>
              {editingId
                ? "Update Transaction"
                : `Add ${transactionType === "income" ? "Income" : "Expense"}`}
            </Text>
          </TouchableOpacity>

          {editingId && (
            <TouchableOpacity
              style={[
                styles.secondaryCancelButton,
                { backgroundColor: theme.cardSecondary },
              ]}
              onPress={resetForm}
            >
              <Text style={[styles.cancelText, { color: theme.text }]}>
                Cancel Editing
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Filter Transactions
          </Text>

          <View style={styles.filterWrap}>
            {[
              { key: "all", label: "All" },
              { key: "thisWeek", label: "This Week" },
              { key: "lastWeek", label: "Last Week" },
              { key: "lastMonth", label: "Last Month" },
              { key: "last3Months", label: "Last 3 Months" },
              { key: "custom", label: "Custom" },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor:
                      selectedFilter === filter.key
                        ? theme.blue
                        : theme.cardSecondary,
                  },
                ]}
                onPress={() => setSelectedFilter(filter.key as FilterType)}
              >
                <Text style={styles.filterButtonText}>{filter.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedFilter === "custom" && (
            <View style={styles.customDateBox}>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  { backgroundColor: theme.inputBg, borderColor: theme.border },
                ]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={[styles.dateButtonText, { color: theme.text }]}>
                  Start: {formatOnlyDate(customStartDate)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dateButton,
                  { backgroundColor: theme.inputBg, borderColor: theme.border },
                ]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={[styles.dateButtonText, { color: theme.text }]}>
                  End: {formatOnlyDate(customEndDate)}
                </Text>
              </TouchableOpacity>

              {customStartDate > customEndDate && (
                <Text style={[styles.dateErrorText, { color: theme.red }]}>
                  Start date cannot be after end date.
                </Text>
              )}
            </View>
          )}
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={customStartDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowStartPicker(false);
              if (selectedDate) setCustomStartDate(selectedDate);
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={customEndDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowEndPicker(false);
              if (selectedDate) setCustomEndDate(selectedDate);
            }}
          />
        )}

        <View
          style={[
            styles.exportCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Export Reports
          </Text>

          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: theme.blue }]}
              onPress={exportToCSV}
            >
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: theme.purple }]}
              onPress={exportToPDF}
            >
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.chartSectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Expense Breakdown
          </Text>

          {pieChartData.length === 0 ? (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              ]}
            >
              <Text style={styles.emptyStateEmoji}>📊</Text>
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                No expense chart yet
              </Text>
              <Text
                style={[styles.emptyStateSubtitle, { color: theme.textMuted }]}
              >
                Add a few expense entries and this section will turn into a visual
                spending breakdown.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.pieWrapper}>
                <PieChart
                  data={pieChartData}
                  width={chartWidth}
                  height={220}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="32"
                  hasLegend={false}
                  chartConfig={{
                    color: (opacity = 1) =>
                      themeMode === "light"
                        ? `rgba(15,23,42,${opacity})`
                        : `rgba(255,255,255,${opacity})`,
                  }}
                  absolute
                />
              </View>

              <View style={styles.customLegend}>
                {pieChartData.map((item, index) => {
                  const percentage =
                    expenseTotalForPercentage > 0
                      ? Number(
                          ((item.population / expenseTotalForPercentage) * 100).toFixed(1)
                        )
                      : 0;

                  return (
                    <View
                      key={`${item.name}-${index}`}
                      style={[
                        styles.legendItem,
                        {
                          backgroundColor: theme.cardSecondary,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.legendHeaderRow}>
                        <View style={styles.legendLeft}>
                          <View
                            style={[
                              styles.legendIconWrap,
                              { backgroundColor: `${item.color}22` },
                            ]}
                          >
                            <Text style={styles.legendEmoji}>
                              {getCategoryIcon(item.name)}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.legendCategory, { color: theme.text }]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.legendPercent,
                                { color: theme.textMuted },
                              ]}
                            >
                              {percentage}% of total expense
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.legendValue, { color: theme.text }]}>
                          ₹{formatCurrency(item.population)}
                        </Text>
                      </View>

                      <AnimatedProgressBar
                        percentage={percentage}
                        color={item.color}
                        trackColor={theme.border}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.chartSectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Monthly Expense Trend
          </Text>

          {analytics.monthlySummary.length === 0 ? (
            <View
              style={[
                styles.emptyStateCard,
                { backgroundColor: theme.cardSecondary, borderColor: theme.border },
              ]}
            >
              <Text style={styles.emptyStateEmoji}>📉</Text>
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                No monthly trend yet
              </Text>
              <Text
                style={[styles.emptyStateSubtitle, { color: theme.textMuted }]}
              >
                As soon as you log transactions across dates, this chart will show
                how spending changes over time.
              </Text>
            </View>
          ) : (
            <>
              <BarChart
                data={monthlyExpenseChartData}
                width={chartWidth}
                height={240}
                fromZero
                yAxisLabel=""
                showValuesOnTopOfBars
                showBarTops={false}
                withInnerLines
                withHorizontalLabels
                withVerticalLabels
                segments={4}
                flatColor
                chartConfig={{
                  backgroundColor: theme.card,
                  backgroundGradientFrom: theme.card,
                  backgroundGradientTo: theme.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) =>
                    themeMode === "light"
                      ? `rgba(220,38,38,${opacity})`
                      : `rgba(239,68,68,${opacity})`,
                  labelColor: (opacity = 1) =>
                    themeMode === "light"
                      ? `rgba(15,23,42,${opacity})`
                      : `rgba(226,232,240,${opacity})`,
                  fillShadowGradient:
                    themeMode === "light" ? "#dc2626" : "#ef4444",
                  fillShadowGradientOpacity: 1,
                  barPercentage: 0.58,
                  propsForBackgroundLines: {
                    stroke: theme.border,
                    strokeWidth: 1,
                    strokeDasharray: "",
                  },
                  propsForLabels: {
                    fontSize: 11,
                  },
                }}
                style={styles.chartStyle}
                verticalLabelRotation={0}
              />
              <Text style={[styles.chartHint, { color: theme.textMuted }]}>
                This visual helps you quickly spot spending trends for the selected
                period.
              </Text>
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Monthly Summary
        </Text>

        {analytics.monthlySummary.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No monthly summary available for this filter.
            </Text>
          </View>
        ) : (
          analytics.monthlySummary.map((item) => (
            <View
              key={item.monthKey}
              style={[
                styles.summaryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.summaryMonth, { color: theme.text }]}>
                {item.label}
              </Text>
              <View style={styles.summaryRowInside}>
                <Text style={[styles.summaryIncome, { color: theme.green }]}>
                  Income: ₹{formatCurrency(item.income)}
                </Text>
                <Text style={[styles.summaryExpense, { color: theme.red }]}>
                  Expense: ₹{formatCurrency(item.expense)}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Income by Category
        </Text>

        {analytics.incomeByCategory.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No income categories available for this filter.
            </Text>
          </View>
        ) : (
          <View style={styles.categoryListWrap}>
            {analytics.incomeByCategory.map((item) => (
              <View
                key={item.category}
                style={[
                  styles.categoryPremiumCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View style={styles.categoryPremiumLeft}>
                  <View
                    style={[
                      styles.categoryPremiumIconWrap,
                      { backgroundColor: "rgba(34,197,94,0.12)" },
                    ]}
                  >
                    <Text style={styles.categoryIcon}>
                      {getCategoryIcon(item.category)}
                    </Text>
                  </View>

                  <View style={styles.categoryPremiumTextWrap}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>
                      {item.category}
                    </Text>
                    <Text
                      style={[styles.categorySubText, { color: theme.textMuted }]}
                    >
                      Income category
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryAmountPill}>
                  <Text
                    style={[styles.categoryIncomeAmount, { color: theme.green }]}
                  >
                    ₹{formatCurrency(item.total)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Expense by Category
        </Text>

        {analytics.expenseByCategory.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No expense categories available for this filter.
            </Text>
          </View>
        ) : (
          <View style={styles.categoryListWrap}>
            {analytics.expenseByCategory.map((item) => (
              <View
                key={item.category}
                style={[
                  styles.categoryPremiumCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}
              >
                <View style={styles.categoryPremiumLeft}>
                  <View
                    style={[
                      styles.categoryPremiumIconWrap,
                      { backgroundColor: "rgba(239,68,68,0.12)" },
                    ]}
                  >
                    <Text style={styles.categoryIcon}>
                      {getCategoryIcon(item.category)}
                    </Text>
                  </View>

                  <View style={styles.categoryPremiumTextWrap}>
                    <Text style={[styles.categoryName, { color: theme.text }]}>
                      {item.category}
                    </Text>
                    <Text
                      style={[styles.categorySubText, { color: theme.textMuted }]}
                    >
                      Expense category
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryAmountPill}>
                  <Text
                    style={[styles.categoryExpenseAmount, { color: theme.red }]}
                  >
                    ₹{formatCurrency(item.total)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Filtered Transaction History
        </Text>

        {filteredTransactions.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              { backgroundColor: theme.cardSecondary, borderColor: theme.border },
            ]}
          >
            <Text style={styles.emptyStateEmoji}>🧾</Text>
            <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
              No transactions found
            </Text>
            <Text
              style={[styles.emptyStateSubtitle, { color: theme.textMuted }]}
            >
              Try changing the filter or add a new transaction to see your history
              here.
            </Text>
          </View>
        ) : (
          filteredTransactions.map((item) => (
            <View
              key={item.id}
              style={[
                styles.historyItem,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.historyTopRow}>
                <View style={styles.historyTitleLeft}>
                  <Text style={styles.historyEmoji}>
                    {getCategoryIcon(item.category)}
                  </Text>
                  <Text style={[styles.historyType, { color: theme.text }]}>
                    {item.description}
                  </Text>
                </View>

                <Text
                  style={[
                    item.type === "income"
                      ? styles.historyAmountIncome
                      : styles.historyAmountExpense,
                    { color: item.type === "income" ? theme.green : theme.red },
                  ]}
                >
                  {item.type === "income" ? "+" : "-"}₹{formatCurrency(item.amount)}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.historyBadge,
                    { backgroundColor: theme.badge, color: theme.text },
                  ]}
                >
                  {item.type.toUpperCase()}
                </Text>
                <Text style={[styles.historyCategory, { color: theme.textSoft }]}>
                  {item.category}
                </Text>
              </View>

              <Text style={[styles.historyDate, { color: theme.blue }]}>
                {formatDateTime(item.createdAt)}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: theme.blue }]}
                  onPress={() => editTransaction(item)}
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    { backgroundColor: theme.deleteBg },
                  ]}
                  onPress={() => deleteTransaction(item.id)}
                >
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingTop: 90,
    paddingBottom: 40,
  },
  toastWrapper: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    zIndex: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  logo: {
    width: 220,
    height: 130,
    alignSelf: "center",
    marginBottom: 6,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
  },
  appSubHeading: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: "600",
  },
  themeToggleButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 22,
  },
  greetingCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  greetingSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  heroInsightCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
  },
  heroInsightTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  heroInsightTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  heroInsightEmoji: {
    fontSize: 24,
  },
  heroInsightText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  topCard: {
    width: "48.5%",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "700",
  },
  balance: {
    fontSize: 23,
    fontWeight: "800",
  },
  expense: {
    fontSize: 23,
    fontWeight: "800",
  },
  incomeText: {
    fontSize: 23,
    fontWeight: "800",
  },
  savingsText: {
    fontSize: 23,
    fontWeight: "800",
  },
  formCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 14,
  },
  typeSwitchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 2,
  },
  input: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  categorySelectCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.4,
  },
  categorySelectHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categorySelectEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  categorySelectTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  categorySelectSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  pickerWrapperLarge: {
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 58,
    justifyContent: "center",
  },
  picker: {
    color: "#0f172a",
  },
  primarySaveButton: {
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  secondaryCancelButton: {
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  cancelText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 10,
  },
  filterButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  customDateBox: {
    marginTop: 8,
  },
  dateButton: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dateErrorText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  exportCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
  },
  exportRow: {
    flexDirection: "row",
    gap: 10,
  },
  exportButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
  },
  exportButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
  },
  chartSectionCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  pieWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  customLegend: {
    width: "100%",
    marginTop: 10,
  },
  legendItem: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  legendHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  legendIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  legendEmoji: {
    fontSize: 20,
  },
  legendCategory: {
    fontSize: 15,
    fontWeight: "700",
  },
  legendPercent: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  legendValue: {
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 10,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  chartStyle: {
    borderRadius: 16,
    marginLeft: -8,
  },
  chartHint: {
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 20,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  summaryMonth: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },
  summaryRowInside: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryIncome: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryExpense: {
    fontSize: 15,
    fontWeight: "700",
  },
  categoryListWrap: {
    marginBottom: 4,
  },
  categoryPremiumCard: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  categoryPremiumLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  categoryPremiumIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryPremiumTextWrap: {
    flex: 1,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "800",
  },
  categorySubText: {
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 3,
  },
  categoryAmountPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.12)",
  },
  categoryIncomeAmount: {
    fontSize: 15,
    fontWeight: "800",
  },
  categoryExpenseAmount: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptyBox: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyStateCard: {
    width: "100%",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyStateEmoji: {
    fontSize: 34,
    marginBottom: 10,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  historyItem: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  historyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  historyEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  historyType: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  historyAmountIncome: {
    fontSize: 16,
    fontWeight: "800",
  },
  historyAmountExpense: {
    fontSize: 16,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  historyBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 8,
  },
  historyCategory: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyDate: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionButtonText: {
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "700",
  },
});