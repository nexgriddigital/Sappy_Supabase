import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  TrendingDown,
  Trash2,
  Calendar,
  X,
  PieChart,
} from 'lucide-react';
import { Expense, ExpenseCategory, StoreConfig } from '../types/pos.ts';

interface ExpensesTabProps {
  expenses: Expense[];
  config: StoreConfig;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent & Lease',
  'Electricity & Utilities',
  'Stationery Stock & Freight',
  'Packaging & Bags',
  'Staff Wages',
  'Maintenance & Repairs',
  'Transport & Delivery',
  'Office & Admin',
  'Miscellaneous',
];

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  config,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Electricity & Utilities');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [formPayee, setFormPayee] = useState('');
  const [formReceipt, setFormReceipt] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Filter Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.payee.toLowerCase().includes(q) ||
        (e.receiptNumber && e.receiptNumber.toLowerCase().includes(q));

      return matchCat && matchSearch;
    });
  }, [expenses, selectedCategory, searchQuery]);

  // Aggregate Metrics
  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.amount, 0);

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const mtdExpenses = expenses
    .filter((e) => e.date.startsWith(currentMonthStr))
    .reduce((acc, e) => acc + e.amount, 0);

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const map: Partial<Record<ExpenseCategory, number>> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const topCategory = categoryTotals[0] ? categoryTotals[0][0] : 'None';

  // Handle Form Submit
  const handleRecordExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formAmount || !formPayee) return;

    onSaveExpense({
      date: formDate,
      category: formCategory,
      title: formTitle.trim(),
      amount: parseFloat(formAmount) || 0,
      paymentMethod: formMethod,
      payee: formPayee.trim(),
      receiptNumber: formReceipt.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });

    setIsModalOpen(false);
    // Reset Form
    setFormTitle('');
    setFormAmount('');
    setFormPayee('');
    setFormReceipt('');
    setFormNotes('');
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal-900">
            Stationery Store Operational Expenses
          </h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Log store overhead, utility bills, packaging, and freight costs to calculate true Net Profit in P&L reports.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs self-start md:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4 text-forest-200" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Month-to-Date Expenses</p>
          <p className="text-xl font-extrabold font-mono text-rose-400 mt-1">
            {config.currencySymbol}{mtdExpenses.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">For current calendar month</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Total Expenses Recorded</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}{totalExpenseAmount.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">{expenses.length} expense entries</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Highest Expense Category</p>
          <p className="text-sm font-bold text-forest-400 truncate mt-1">
            {topCategory}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">
            {categoryTotals[0] ? `${config.currencySymbol}${categoryTotals[0][1].toFixed(2)} total` : `${config.currencySymbol}0.00`}
          </p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Average Expense Entry</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}
            {expenses.length > 0 ? (totalExpenseAmount / expenses.length).toFixed(2) : '0.00'}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">Across all records</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search expense title, payee, receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 bg-charcoal-950 border border-charcoal-700 rounded-lg text-xs font-medium text-white cursor-pointer self-start md:self-auto focus:border-forest-500"
        >
          <option value="all">All Expense Categories</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat} className="bg-charcoal-900 text-white">{cat}</option>
          ))}
        </select>

      </div>

      {/* Expenses Table */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Expense Date</th>
                <th className="py-3 px-4">Title / Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Payee / Vendor</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-charcoal-800/50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-charcoal-300">
                    {expense.date}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white">{expense.title}</p>
                    {expense.notes && (
                      <p className="text-[10px] text-charcoal-400">{expense.notes}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-charcoal-300 bg-charcoal-950 border border-charcoal-700/60 px-2 py-0.5 rounded text-[11px] font-medium">
                      {expense.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-charcoal-200 font-medium">
                    {expense.payee}
                    {expense.receiptNumber && (
                      <span className="block text-[10px] text-charcoal-400 font-mono">Ref: {expense.receiptNumber}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 capitalize text-charcoal-300 font-mono">
                    {expense.paymentMethod}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-extrabold text-rose-400 text-sm">
                    -{config.currencySymbol}{expense.amount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onDeleteExpense(expense.id)}
                      className="p-1.5 text-charcoal-400 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="p-10 text-center text-charcoal-400">
            <DollarSign className="w-8 h-8 mx-auto text-charcoal-600 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-charcoal-200">No expenses found</p>
            <p className="text-xs text-charcoal-400 mt-1">Click &quot;Record Expense&quot; above to log a new store cost.</p>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordExpenseSubmit}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Record Store Operating Expense</h3>
                <p className="text-xs text-charcoal-400">Log costs to reflect accurate net margins in P&L statements.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Expense Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white focus:border-forest-500"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-charcoal-900 text-white">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Expense Title / Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Electricity & AC Bill, Packaging Kraft Bags"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-sm text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Amount Paid ({config.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg font-mono font-bold text-rose-400 text-sm focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Payment Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg capitalize text-white focus:border-forest-500"
                  >
                    <option value="cash" className="bg-charcoal-900 text-white">Cash</option>
                    <option value="card" className="bg-charcoal-900 text-white">Bank Card</option>
                    <option value="digital" className="bg-charcoal-900 text-white">Digital / Bank Wire</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Payee / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Municipal Power, EcoPack"
                    value={formPayee}
                    onChange={(e) => setFormPayee(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Receipt / Invoice Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. RCPT-1192"
                    value={formReceipt}
                    onChange={(e) => setFormReceipt(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional invoice notes or payment specifics..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 border border-rose-600/50"
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
