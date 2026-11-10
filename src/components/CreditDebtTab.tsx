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
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  BadgeCheck,
  Trash2,
} from 'lucide-react';
import { CreditPayment, Customer, Sale, StoreConfig } from '../types/pos.ts';

interface CreditDebtTabProps {
  customers: Customer[];
  sales: Sale[];
  creditPayments: CreditPayment[];
  config: StoreConfig;
  onSaveCustomer: (customer: Customer) => void;
  onRecordPayment: (
    payment: Omit<CreditPayment, 'id' | 'timestamp' | 'receiptNumber'> & { timestamp?: string }
  ) => void;
  onAdjustCredit?: (customerId: string, amountDelta: number, reason: string) => void;
  onDeleteCustomer?: (customerId: string) => void;
}

export const CreditDebtTab: React.FC<CreditDebtTabProps> = ({
  customers,
  sales,
  creditPayments,
  config,
  onSaveCustomer,
  onRecordPayment,
  onAdjustCredit,
  onDeleteCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debtors' | 'settled'>('debtors');

  // Modal States
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isManualCreditModalOpen, setIsManualCreditModalOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Manual Credit Entry Form State
  const [manualEntryMode, setManualEntryMode] = useState<'external_payment' | 'manual_debt'>('external_payment');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualChannel, setManualChannel] = useState('Telebirr');
  const [manualReference, setManualReference] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [manualCollector, setManualCollector] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualFeedback, setManualFeedback] = useState<string | null>(null);

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

  // Open Manual Credit Entry Modal
  const handleOpenManualCredit = (
    customer?: Customer,
    mode: 'external_payment' | 'manual_debt' = 'external_payment'
  ) => {
    const targetCust = customer || customers.find((c) => c.creditBalance > 0) || customers[0];
    setManualCustomerId(targetCust ? targetCust.id : '');
    setManualEntryMode(mode);
    if (mode === 'external_payment' && targetCust && targetCust.creditBalance > 0) {
      setManualAmount(targetCust.creditBalance.toFixed(2));
    } else {
      setManualAmount('');
    }
    setManualChannel('Telebirr');
    setManualReference('');
    setManualDate(new Date().toISOString().slice(0, 16));
    setManualCollector('');
    setManualNotes('');
    setManualFeedback(null);
    setIsManualCreditModalOpen(true);
  };

  // Handle Submit Manual External Credit / Debt Adjustment
  const handleSubmitManualCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === manualCustomerId);
    if (!customer) {
      setManualFeedback('Please select a customer.');
      return;
    }
    const numericAmount = parseFloat(manualAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setManualFeedback('Please enter a valid positive amount.');
      return;
    }

    if (manualEntryMode === 'external_payment') {
      const channelDesc = manualChannel;
      const refDesc = manualReference.trim() ? ` (Ref: ${manualReference.trim()})` : '';
      const notes = manualNotes.trim() || `Externally paid debt via ${channelDesc}${refDesc}`;

      onRecordPayment({
        customerId: customer.id,
        customerName: customer.name,
        amount: numericAmount,
        paymentMethod: 'digital',
        isExternal: true,
        externalChannel: manualChannel,
        externalReference: manualReference.trim() || undefined,
        collectedBy: manualCollector.trim() || undefined,
        notes,
        timestamp: manualDate ? new Date(manualDate).toISOString() : new Date().toISOString(),
      });
    } else {
      // Manual offline credit debt addition / debit adjustment
      if (onAdjustCredit) {
        const refDesc = manualReference.trim() ? ` [Ref: ${manualReference.trim()}]` : '';
        const reason = manualNotes.trim()
          ? `${manualNotes.trim()}${refDesc}`
          : `Manual offline credit debt recorded${refDesc}`;
        onAdjustCredit(customer.id, numericAmount, reason);
      }
    }

    setIsManualCreditModalOpen(false);
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
        isExternal: false,
        externalChannel: undefined,
        externalReference: undefined,
        collectedBy: undefined,
      }));

    const custPayments = creditPayments
      .filter((p) => p.customerId === activeCustomer.id)
      .map((p) => ({
        type: 'payment' as const,
        id: p.id,
        date: p.timestamp,
        ref: p.receiptNumber,
        desc: p.notes || `Debt settlement via ${p.paymentMethod.toUpperCase()}`,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        isExternal: p.isExternal,
        externalChannel: p.externalChannel,
        externalReference: p.externalReference,
        collectedBy: p.collectedBy,
      }));

    return [...custSales, ...custPayments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [activeCustomer, sales, creditPayments]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      
      {/* Header & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Customer Credit & Debt Ledger
          </h1>
          <p className="text-xs text-charcoal-400 mt-0.5">
            Manage customer credit accounts, track overdue balances, and record external payments (Telebirr, CBE Bank, Checks).
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            onClick={() => handleOpenManualCredit()}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-95 border border-emerald-500/50"
          >
            <Smartphone className="w-4 h-4 text-emerald-200" />
            <span>Manual Credit Entry</span>
          </button>

          <button
            onClick={() => setIsNewCustModalOpen(true)}
            className="px-4 py-2 bg-forest-700 hover:bg-forest-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-2xs active:scale-95 border border-forest-600/50"
          >
            <Plus className="w-4 h-4 text-forest-200" />
            <span>Add Credit Customer</span>
          </button>
        </div>
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
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
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
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {hasDebt && (
                          <>
                            <button
                              onClick={() => handleOpenManualCredit(cust, 'external_payment')}
                              className="px-2.5 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-800/80 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                              title="Record external mobile/bank payment (Telebirr, CBE, check)"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                              <span>External Pay</span>
                            </button>
                            <button
                              onClick={() => handleOpenPayment(cust)}
                              className="px-2.5 py-1.5 bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs border border-forest-700/50 active:scale-95"
                              title="Record an in-store counter payment"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-forest-300" />
                              <span>Collect Debt</span>
                            </button>
                          </>
                        )}
                        {!hasDebt && (
                          <button
                            onClick={() => handleOpenManualCredit(cust, 'manual_debt')}
                            className="px-2.5 py-1.5 bg-charcoal-800/80 hover:bg-charcoal-700 text-charcoal-300 hover:text-white border border-charcoal-700/80 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Add offline credit purchase"
                          >
                            <Plus className="w-3 h-3 text-charcoal-400" />
                            <span>Add Debt</span>
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
                        <button
                          onClick={() => setCustomerToDelete(cust)}
                          className="px-2 py-1.5 bg-rose-950/40 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-800/40 hover:border-rose-700 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                          title={`Delete account for ${cust.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Delete</span>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                            isSale
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                              : item.isExternal
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800/80'
                              : 'bg-forest-950/80 text-forest-300 border-forest-800/80'
                          }`}
                        >
                          {isSale
                            ? 'Credit Sale'
                            : item.isExternal
                            ? 'External Payment'
                            : 'Payment Received'}
                        </span>
                        <span className="font-mono font-semibold text-white">{item.ref}</span>
                        {item.isExternal && item.externalChannel && (
                          <span className="text-[10px] bg-charcoal-800 text-emerald-300 px-2 py-0.5 rounded border border-charcoal-700 font-mono inline-flex items-center gap-1">
                            <Smartphone className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{item.externalChannel}</span>
                            {item.externalReference && <span>· #{item.externalReference}</span>}
                          </span>
                        )}
                      </div>
                      <p className="text-charcoal-300">{item.desc}</p>
                      <div className="flex items-center gap-3 text-[10px] text-charcoal-400 font-mono">
                        <span>{formattedDate}</span>
                        {item.collectedBy && (
                          <span>Recorded by: {item.collectedBy}</span>
                        )}
                      </div>
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

      {/* MANUAL CREDIT ENTRY MODAL (EXTERNAL PAYMENTS & OFFLINE CREDIT) */}
      {isManualCreditModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitManualCredit}
            className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-xl w-full border border-charcoal-800 overflow-hidden flex flex-col my-auto text-charcoal-100 max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manual External Credit Entry</h3>
                  <p className="text-xs text-charcoal-400">
                    Record credit settlements paid via Telebirr, CBE Bank, or checks per customer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualCreditModalOpen(false)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              
              {/* Mode Toggle: External Settlement vs Manual Offline Debt */}
              <div className="grid grid-cols-2 gap-2 bg-charcoal-950 p-1.5 rounded-xl border border-charcoal-800">
                <button
                  type="button"
                  onClick={() => {
                    setManualEntryMode('external_payment');
                    const c = customers.find((cust) => cust.id === manualCustomerId);
                    if (c && c.creditBalance > 0) {
                      setManualAmount(c.creditBalance.toFixed(2));
                    }
                  }}
                  className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    manualEntryMode === 'external_payment'
                      ? 'bg-emerald-800 text-white shadow-xs border border-emerald-600/60'
                      : 'text-charcoal-400 hover:text-charcoal-200'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-300" />
                  <span>External Paid Settlement</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualEntryMode('manual_debt');
                    setManualAmount('');
                  }}
                  className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    manualEntryMode === 'manual_debt'
                      ? 'bg-amber-800 text-white shadow-xs border border-amber-600/60'
                      : 'text-charcoal-400 hover:text-charcoal-200'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-amber-300" />
                  <span>Add Offline Credit Debt</span>
                </button>
              </div>

              {/* Customer Selector */}
              <div>
                <label className="block text-charcoal-300 font-semibold mb-1.5">
                  Select Customer Account *
                </label>
                <select
                  value={manualCustomerId}
                  onChange={(e) => {
                    setManualCustomerId(e.target.value);
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c && manualEntryMode === 'external_payment' && c.creditBalance > 0) {
                      setManualAmount(c.creditBalance.toFixed(2));
                    }
                  }}
                  required
                  className="w-full px-3 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white font-medium focus:border-forest-500 focus:ring-1 focus:ring-forest-500 cursor-pointer"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-charcoal-900 text-white">
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} — Debt: {config.currencySymbol}{c.creditBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Customer Balance Insight Card */}
              {(() => {
                const selCust = customers.find((c) => c.id === manualCustomerId);
                if (!selCust) return null;
                return (
                  <div className="p-3 bg-charcoal-950/80 rounded-xl border border-charcoal-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-charcoal-400">Current Outstanding Debt</p>
                      <p className="text-base font-extrabold font-mono text-amber-400">
                        {config.currencySymbol}{selCust.creditBalance.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-charcoal-400">Credit Limit</p>
                      <p className="text-xs font-mono font-bold text-charcoal-200">
                        {config.currencySymbol}{selCust.creditLimit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Amount & Quick Settlement Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-charcoal-300 font-semibold">
                    {manualEntryMode === 'external_payment' ? 'Payment Amount Received *' : 'Credit Amount to Add *'}
                  </label>
                  {manualEntryMode === 'external_payment' && (() => {
                    const selCust = customers.find((c) => c.id === manualCustomerId);
                    if (!selCust || selCust.creditBalance <= 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setManualAmount(selCust.creditBalance.toFixed(2))}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-2"
                      >
                        Set to Full Balance ({config.currencySymbol}{selCust.creditBalance.toFixed(2)})
                      </button>
                    );
                  })()}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-mono font-bold text-charcoal-400">
                    {config.currencySymbol.trim()}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white font-mono font-bold text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500"
                  />
                </div>
              </div>

              {/* Payment Channel Selector (for external payments) */}
              {manualEntryMode === 'external_payment' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-charcoal-300 font-semibold mb-1">
                      External Payment Channel *
                    </label>
                    <select
                      value={manualChannel}
                      onChange={(e) => setManualChannel(e.target.value)}
                      className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white focus:border-forest-500 cursor-pointer"
                    >
                      <option value="Telebirr">Telebirr (Ethio Telecom)</option>
                      <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                      <option value="Awash Bank">Awash Bank</option>
                      <option value="Dashen Bank / Amole">Dashen Bank / Amole</option>
                      <option value="Bank Check / Draft">Bank Check / Pay Order</option>
                      <option value="Direct Cash Handover">Direct Cash Handover (Field/Office)</option>
                      <option value="Other Bank Transfer">Other Bank Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-charcoal-300 font-semibold mb-1">
                      Transaction / Slip / Check Ref #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TXN-894721 or CBE-004812"
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                      className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                    />
                  </div>
                </div>
              )}

              {/* Reference ID when in manual debt mode */}
              {manualEntryMode === 'manual_debt' && (
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Invoice / Delivery Slip Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MANUAL-INV-2041 or PO-771"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 font-mono focus:border-forest-500"
                  />
                </div>
              )}

              {/* Date & Verified By Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Transaction Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white font-mono focus:border-forest-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-charcoal-300 font-semibold mb-1">
                    Verified / Collected By
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cashier Abebe or Manager"
                    value={manualCollector}
                    onChange={(e) => setManualCollector(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:border-forest-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-charcoal-300 font-semibold mb-1">
                  Internal Notes / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. Confirmed via Telebirr merchant portal notification"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-950 border border-charcoal-700 rounded-xl text-white placeholder-charcoal-500 focus:border-forest-500"
                />
              </div>

              {/* Live Balance Impact Preview */}
              {(() => {
                const selCust = customers.find((c) => c.id === manualCustomerId);
                if (!selCust) return null;
                const amt = parseFloat(manualAmount) || 0;
                const currentBal = selCust.creditBalance;
                const newBal =
                  manualEntryMode === 'external_payment'
                    ? Math.max(0, currentBal - amt)
                    : currentBal + amt;

                return (
                  <div className="p-3 bg-charcoal-950 rounded-xl border border-charcoal-800 space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-charcoal-400">
                      <span>Current Debt:</span>
                      <span>{config.currencySymbol}{currentBal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-charcoal-300">
                      <span>
                        {manualEntryMode === 'external_payment' ? 'Settlement Payment:' : 'Added Offline Debt:'}
                      </span>
                      <span className={manualEntryMode === 'external_payment' ? 'text-emerald-400' : 'text-amber-400'}>
                        {manualEntryMode === 'external_payment' ? '-' : '+'}{config.currencySymbol}{amt.toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-charcoal-800 flex justify-between font-bold text-white">
                      <span>Projected New Balance:</span>
                      <span className={newBal === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {config.currencySymbol}{newBal.toFixed(2)}
                      </span>
                    </div>
                    {manualEntryMode === 'external_payment' && newBal === 0 && amt > 0 && (
                      <p className="text-[11px] text-emerald-400 font-sans font-semibold pt-0.5 flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        <span>This payment will completely clear this customer's debt.</span>
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Error feedback */}
              {manualFeedback && (
                <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{manualFeedback}</span>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsManualCreditModalOpen(false)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 font-bold rounded-xl cursor-pointer shadow-sm active:scale-95 transition-colors border ${
                  manualEntryMode === 'external_payment'
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600/50'
                    : 'bg-amber-700 hover:bg-amber-600 text-white border-amber-600/50'
                }`}
              >
                {manualEntryMode === 'external_payment'
                  ? 'Record External Payment'
                  : 'Apply Manual Debt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-charcoal-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-charcoal-900 rounded-2xl shadow-2xl max-w-md w-full border border-charcoal-800 overflow-hidden text-charcoal-100 flex flex-col my-auto">
            <div className="bg-charcoal-950 text-white px-6 py-4 flex items-center justify-between border-b border-charcoal-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Customer Account</h3>
                  <p className="text-[11px] text-charcoal-400">Remove from credit ledger & database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="text-charcoal-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-charcoal-200 text-sm">
                Are you sure you want to permanently delete{' '}
                <strong className="text-white font-bold">"{customerToDelete.name}"</strong>?
              </p>

              {customerToDelete.companyName && (
                <p className="text-xs text-charcoal-400 -mt-2">
                  Company / School: <span className="text-charcoal-300 font-medium">{customerToDelete.companyName}</span>
                </p>
              )}

              {customerToDelete.creditBalance > 0 ? (
                <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-start gap-2.5 text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold text-amber-300">Outstanding Debt Warning:</span> This account currently has{' '}
                    <span className="font-bold font-mono text-white bg-amber-900/60 px-1.5 py-0.5 rounded">
                      {config.currencySymbol}{customerToDelete.creditBalance.toFixed(2)}
                    </span>{' '}
                    unsettled balance. Deleting will permanently remove their debt record.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-charcoal-950 border border-charcoal-800 rounded-xl flex items-center gap-2 text-charcoal-300 text-[11px]">
                  <CheckCircle className="w-4 h-4 text-forest-400 shrink-0" />
                  <span>Account is fully settled (zero balance). Safe to remove.</span>
                </div>
              )}

              <p className="text-[11px] text-charcoal-400">
                This deletion will immediately synchronize across all connected devices and Supabase database.
              </p>
            </div>

            <div className="px-6 py-4 bg-charcoal-950 border-t border-charcoal-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 font-semibold text-charcoal-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomer && customerToDelete) {
                    onDeleteCustomer(customerToDelete.id);
                  }
                  setCustomerToDelete(null);
                }}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-colors border border-rose-600/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
