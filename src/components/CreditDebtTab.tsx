import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  DollarSign,
  AlertCircle,
  FileText,
  Search,
  CheckCircle,
  Clock,
  Receipt,
  X,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import { CreditPayment, Customer, Sale, StoreConfig } from '../types/pos.ts';

interface CreditDebtTabProps {
  customers: Customer[];
  sales: Sale[];
  creditPayments: CreditPayment[];
  config: StoreConfig;
  onSaveCustomer: (customer: Customer) => void;
  onRecordPayment: (payment: Omit<CreditPayment, 'id' | 'timestamp' | 'receiptNumber'>) => void;
}

export const CreditDebtTab: React.FC<CreditDebtTabProps> = ({
  customers,
  sales,
  creditPayments,
  config,
  onSaveCustomer,
  onRecordPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debtors' | 'settled'>('debtors');

  // Modal States
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  // New Customer Form State
  const [custName, setCustName] = useState('');
  const [custCompany, setCustCompany] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custTaxId, setCustTaxId] = useState('');
  const [custLimit, setCustLimit] = useState('800');
  const [custNotes, setCustNotes] = useState('');

  // Payment Settlement Form State
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payReceiptGenerated, setPayReceiptGenerated] = useState<string | null>(null);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchFilter =
        filterType === 'all'
          ? true
          : filterType === 'debtors'
          ? c.creditBalance > 0
          : c.creditBalance === 0;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        c.phone.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [customers, filterType, searchQuery]);

  // Aggregate Metrics
  const totalOutstanding = customers.reduce((acc, c) => acc + c.creditBalance, 0);
  const totalDebtorsCount = customers.filter((c) => c.creditBalance > 0).length;
  const totalApprovedLimits = customers.reduce((acc, c) => acc + c.creditLimit, 0);
  const totalPaymentsCollected = creditPayments.reduce((acc, p) => acc + p.amount, 0);

  // Open Payment Modal
  const handleOpenPayment = (customer: Customer) => {
    setActiveCustomer(customer);
    setPayAmount(customer.creditBalance.toFixed(2));
    setPayReceiptGenerated(null);
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  // Open Statement Modal
  const handleOpenStatement = (customer: Customer) => {
    setActiveCustomer(customer);
    setIsStatementModalOpen(true);
  };

  // Handle Save New Customer
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: custName,
      companyName: custCompany.trim() || undefined,
      phone: custPhone,
      email: custEmail.trim() || undefined,
      address: custAddress.trim() || undefined,
      taxNumber: custTaxId.trim() || undefined,
      creditBalance: 0,
      creditLimit: parseFloat(custLimit) || 500,
      totalPurchased: 0,
      createdAt: new Date().toISOString(),
      notes: custNotes.trim() || undefined,
    };

    onSaveCustomer(newCust);
    setIsNewCustModalOpen(false);
    // Reset Form
    setCustName('');
    setCustCompany('');
    setCustPhone('');
    setCustEmail('');
    setCustAddress('');
    setCustTaxId('');
    setCustLimit('800');
    setCustNotes('');
  };

  // Handle Submit Payment Settlement
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    const numericAmount = parseFloat(payAmount);
    if (!numericAmount || numericAmount <= 0) return;

    onRecordPayment({
      customerId: activeCustomer.id,
      customerName: activeCustomer.name,
      amount: numericAmount,
      paymentMethod: payMethod,
      notes: payNotes.trim() || 'Debt settlement payment',
    });

    setIsPaymentModalOpen(false);
  };

  // Statement Ledger Events for active customer
  const customerHistory = useMemo(() => {
    if (!activeCustomer) return [];

    const custSales = sales
      .filter((s) => s.customerId === activeCustomer.id)
      .map((s) => ({
        type: 'sale' as const,
        id: s.id,
        date: s.timestamp,
        ref: s.invoiceNumber,
        desc: `Credit purchase: ${s.items.length} stationery items`,
        amount: s.totalAmount,
        paymentMethod: s.paymentMethod,
      }));

    const custPayments = creditPayments
      .filter((p) => p.customerId === activeCustomer.id)
      .map((p) => ({
        type: 'payment' as const,
        id: p.id,
        date: p.timestamp,
        ref: p.receiptNumber,
        desc: `Debt settlement via ${p.paymentMethod.toUpperCase()}`,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
      }));

    return [...custSales, ...custPayments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [activeCustomer, sales, creditPayments]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header & Add Customer Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal-900">
            Customer Credit & Debt Ledger
          </h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Manage customer credit accounts, track overdue balances, and record partial or full debt settlement payments.
          </p>
        </div>

        <button
          onClick={() => setIsNewCustModalOpen(true)}
          className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs self-start md:self-auto active:scale-95 border border-forest-600/50"
        >
          <Plus className="w-4 h-4 text-forest-200" />
          <span>Add Credit Customer</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Total Credit Outstanding</p>
          <p className="text-xl font-extrabold font-mono text-amber-400 mt-1">
            {config.currencySymbol}{totalOutstanding.toFixed(2)}
          </p>
          <p className="text-[11px] text-amber-400/80 mt-1">{totalDebtorsCount} accounts with active debt</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Approved Credit Limit Total</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {config.currencySymbol}{totalApprovedLimits.toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">
            {totalApprovedLimits > 0
              ? `${((totalOutstanding / totalApprovedLimits) * 100).toFixed(1)}% limit utilized`
              : '0% limit utilized'}
          </p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Total Debt Settlements Collected</p>
          <p className="text-xl font-extrabold font-mono text-forest-400 mt-1">
            {config.currencySymbol}{totalPaymentsCollected.toFixed(2)}
          </p>
          <p className="text-[11px] text-forest-400/80 mt-1">{creditPayments.length} payments recorded</p>
        </div>

        <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-800 shadow-2xs">
          <p className="text-xs text-charcoal-400 font-medium">Total Customer Accounts</p>
          <p className="text-xl font-extrabold font-mono text-white mt-1">
            {customers.length}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1">
            {customers.length - totalDebtorsCount} accounts fully settled
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-charcoal-900 p-4 rounded-2xl border border-charcoal-800 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search customer, school name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-xs text-white placeholder-charcoal-500 focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
          />
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex items-center gap-1 bg-charcoal-950 border border-charcoal-800 p-1 rounded-lg">
          <button
            onClick={() => setFilterType('debtors')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filterType === 'debtors'
                ? 'bg-amber-600 text-white font-semibold shadow-xs'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            Has Balance ({totalDebtorsCount})
          </button>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-forest-700 text-white font-semibold shadow-xs'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            All Accounts ({customers.length})
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              filterType === 'settled'
                ? 'bg-forest-700 text-white font-semibold shadow-xs'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            Zero Balance ({customers.length - totalDebtorsCount})
          </button>
        </div>

      </div>

      {/* Customer Debtor Accounts Table */}
      <div className="bg-charcoal-900 rounded-2xl border border-charcoal-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-charcoal-950/80 border-b border-charcoal-800 text-charcoal-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Customer / School</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4 text-right">Outstanding Debt</th>
                <th className="py-3 px-4 text-right">Approved Limit</th>
                <th className="py-3 px-4 text-right">Lifetime Spend</th>
                <th className="py-3 px-4 text-center">Credit Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {filteredCustomers.map((cust) => {
                const hasDebt = cust.creditBalance > 0;
                const isOverLimit = cust.creditBalance > cust.creditLimit;

                return (
                  <tr key={cust.id} className="hover:bg-charcoal-800/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{cust.name}</p>
                      {cust.companyName && (
                        <p className="text-[10px] text-charcoal-400">{cust.companyName}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-charcoal-300">{cust.phone}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                      {hasDebt ? (
                        <span className="text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-800/80">
                          {config.currencySymbol}{cust.creditBalance.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-forest-400 font-bold">{config.currencySymbol}0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-charcoal-300">
                      {config.currencySymbol}{cust.creditLimit.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-charcoal-300">
                      {config.currencySymbol}{cust.totalPurchased.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isOverLimit ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800/80">
                          <AlertCircle className="w-3 h-3" />
                          <span>Over Limit</span>
                        </span>
                      ) : hasDebt ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/80">
                          <Clock className="w-3 h-3" />
                          <span>Debt Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest-300 bg-forest-950/80 px-2 py-0.5 rounded-md border border-forest-800/80">
                          <CheckCircle className="w-3 h-3" />
                          <span>Clear</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasDebt && (
                          <button
                            onClick={() => handleOpenPayment(cust)}
                            className="px-2.5 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs border border-forest-700/50 active:scale-95"
                            title="Record a payment towards outstanding balance"
                          >
                            <DollarSign className="w-3.5 h-3.5 text-forest-300" />
                            <span>Collect Debt</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenStatement(cust)}
                          className="px-2.5 py-1.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 border border-charcoal-700 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="View customer statement of accounts"
                        >
                          <FileText className="w-3.5 h-3.5 text-charcoal-400" />
                          <span>Statement</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="p-10 text-center text-charcoal-400">
            <Users className="w-8 h-8 mx-auto text-charcoal-600 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-charcoal-200">No customers found</p>
            <p className="text-xs text-charcoal-400 mt-1">Try switching filters or add a new customer.</p>
          </div>
        )}
      </div>

      {/* RECORD DEBT PAYMENT SETTLEMENT MODAL */}
      {isPaymentModalOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPayment}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-md w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Collect Debt Payment</h3>
                <p className="text-xs text-forest-400 font-semibold">{activeCustomer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              {/* Balance Summary Card */}
              <div className="p-3 bg-charcoal-950 rounded-xl border border-amber-800/40 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-amber-400 font-medium">Current Outstanding Balance:</p>
                  <p className="text-lg font-bold font-mono text-white">
                    {config.currencySymbol}{activeCustomer.creditBalance.toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayAmount(activeCustomer.creditBalance.toFixed(2))}
                  className="px-2.5 py-1 bg-amber-700/60 hover:bg-amber-600 text-white font-semibold rounded text-[11px] cursor-pointer border border-amber-600/50"
                >
                  Pay Full Balance
                </button>
              </div>

              {/* Amount to Pay */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Payment Amount Received ({config.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={activeCustomer.creditBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-2.5 text-lg font-bold font-mono text-white bg-charcoal-950 border border-charcoal-700 rounded-xl focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-charcoal-300 uppercase tracking-wider mb-1.5">
                  Settlement Method:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash' as const, label: 'Cash' },
                    { id: 'card' as const, label: 'Bank Card' },
                    { id: 'digital' as const, label: 'Digital Transfer' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMethod(m.id)}
                      className={`py-2 px-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                        payMethod === m.id
                          ? 'bg-forest-700 border-forest-500 text-white font-bold'
                          : 'bg-charcoal-950 border-charcoal-700 text-charcoal-300 hover:bg-charcoal-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Notes */}
              <div>
                <label className="block text-xs font-medium text-charcoal-400 mb-1">
                  Payment Receipt Note:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received by cashier in cash, receipt issued"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              {/* Remaining Balance Preview */}
              <div className="flex justify-between items-center text-charcoal-400 pt-2 border-t border-charcoal-800">
                <span>Remaining Debt after payment:</span>
                <span className="font-mono font-bold text-forest-400 text-sm">
                  {config.currencySymbol}
                  {Math.max(0, activeCustomer.creditBalance - (parseFloat(payAmount) || 0)).toFixed(2)}
                </span>
              </div>

            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-forest-700 hover:bg-forest-600 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 border border-forest-600/50"
              >
                <Receipt className="w-4 h-4 text-forest-200" />
                <span>Confirm Settlement & Issue Receipt</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOMER ACCOUNT STATEMENT MODAL */}
      {isStatementModalOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-charcoal-800 overflow-hidden flex flex-col max-h-[90vh] text-charcoal-100">
            
            {/* Header */}
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Statement of Account</h3>
                <p className="text-xs text-forest-400 font-mono font-bold">{activeCustomer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStatementModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Summary Banner */}
            <div className="p-4 bg-charcoal-950 border-b border-charcoal-800 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-charcoal-400 font-medium">Contact Phone:</p>
                <p className="font-semibold text-white font-mono mt-0.5">{activeCustomer.phone}</p>
              </div>
              <div>
                <p className="text-charcoal-400 font-medium">Outstanding Balance:</p>
                <p className="font-bold text-amber-400 font-mono mt-0.5 text-sm">
                  {config.currencySymbol}{activeCustomer.creditBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-charcoal-400 font-medium">Approved Limit:</p>
                <p className="font-semibold text-white font-mono mt-0.5">
                  {config.currencySymbol}{activeCustomer.creditLimit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Chronological History List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">
                Transaction & Settlement Timeline:
              </h4>

              {customerHistory.map((item, idx) => {
                const isSale = item.type === 'sale';
                const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-charcoal-800 bg-charcoal-950/70 flex items-center justify-between text-xs hover:bg-charcoal-800/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                            isSale
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                              : 'bg-forest-950/80 text-forest-300 border-forest-800/80'
                          }`}
                        >
                          {isSale ? 'Credit Sale' : 'Payment Received'}
                        </span>
                        <span className="font-mono font-semibold text-white">{item.ref}</span>
                      </div>
                      <p className="text-charcoal-300">{item.desc}</p>
                      <p className="text-[10px] text-charcoal-400 font-mono">{formattedDate}</p>
                    </div>

                    <div className="text-right font-mono font-extrabold text-sm">
                      {isSale ? (
                        <span className="text-amber-400">+{config.currencySymbol}{item.amount.toFixed(2)}</span>
                      ) : (
                        <span className="text-forest-400">-{config.currencySymbol}{item.amount.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {customerHistory.length === 0 && (
                <div className="py-8 text-center text-charcoal-400 text-xs">
                  No credit sales or payments recorded yet for this customer.
                </div>
              )}
            </div>

            <div className="p-4 bg-charcoal-950 border-t border-charcoal-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStatementModalOpen(false)}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 border border-charcoal-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isNewCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCustomer}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-lg w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100"
          >
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div>
                <h3 className="text-base font-bold">Add New Debtor Customer</h3>
                <p className="text-xs text-charcoal-400">Establish credit terms for schools, businesses, or regular clients.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Customer / Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. St. Jude Academy"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Company / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. St. Jude Education Trust"
                    value={custCompany}
                    onChange={(e) => setCustCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+251 91 123 4567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="accounts@school.edu"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Approved Credit Limit ({config.currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    value={custLimit}
                    onChange={(e) => setCustLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white font-mono font-bold focus:border-forest-500"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">Tax / VAT ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="TAX-098231"
                    value={custTaxId}
                    onChange={(e) => setCustTaxId(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Physical / Delivery Address</label>
                <input
                  type="text"
                  placeholder="Street, District, City"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">Notes / Terms</label>
                <input
                  type="text"
                  placeholder="e.g. 30-day net terms, invoice monthly"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-lg text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsNewCustModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-forest-700 hover:bg-forest-600 text-white font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 border border-forest-600/50"
              >
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
