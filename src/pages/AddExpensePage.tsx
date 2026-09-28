import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { usePeople, useAddExpense } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Button } from '@/components/ui/Button';
import { toISODateString } from '@/utils/date';
import { calculateEqualSplit, validateSplit, formatCurrency } from '@/utils/currency';

export const AddExpensePage: React.FC = () => {
  const navigate = useNavigate();
  const setAddPersonOpen = useUIStore((state) => state.setAddPersonOpen);
  const setAddExpenseOpen = useUIStore((state) => state.setAddExpenseOpen);
  const { data: people = [] } = usePeople();
  const addExpenseMutation = useAddExpense();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paidBy, setPaidBy] = useState<string>('you'); // 'you' or person_id
  const [expenseDate, setExpenseDate] = useState(toISODateString());
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(['you']); // 'you' represents owner
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  // When people load, by default select all friends if initial state has just 'you'
  useEffect(() => {
    if (people.length > 0 && selectedParticipants.length === 1 && selectedParticipants[0] === 'you') {
      setSelectedParticipants(['you', ...people.map((p) => p.id)]);
    }
  }, [people]);

  // Handle participant toggle
  const toggleParticipant = (id: string) => {
    if (selectedParticipants.includes(id)) {
      if (selectedParticipants.length === 1) {
        setError('At least one participant must be included');
        return;
      }
      setSelectedParticipants(selectedParticipants.filter((p) => p !== id));
    } else {
      setSelectedParticipants([...selectedParticipants, id]);
    }
    setError('');
  };

  // Recalculate equal shares or prepare custom split
  const equalSharesArray = calculateEqualSplit(amount, selectedParticipants.length);
  const equalSharesMap: Record<string, number> = {};
  selectedParticipants.forEach((id, idx) => {
    equalSharesMap[id] = equalSharesArray[idx] || 0;
  });

  // Split validation for custom mode
  const currentShares = splitType === 'equal' ? equalSharesMap : customShares;
  const currentSharesList = selectedParticipants.map((id) => currentShares[id] || 0);
  const splitValidation = validateSplit(amount, currentSharesList);

  const handleCustomShareChange = (id: string, val: number) => {
    setCustomShares((prev) => ({
      ...prev,
      [id]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (amount <= 0) {
      setError('Amount must be greater than ₹0');
      return;
    }
    if (selectedParticipants.length === 0) {
      setError('Select at least one participant');
      return;
    }

    if (splitType === 'custom' && !splitValidation.isValid) {
      setError(splitValidation.message || 'Custom shares do not match total');
      return;
    }

    const participantsPayload = selectedParticipants.map((id) => ({
      person_id: id === 'you' ? null : id,
      share_amount: splitType === 'equal' ? equalSharesMap[id] : (customShares[id] || 0),
    }));

    try {
      await addExpenseMutation.mutateAsync({
        description: description.trim(),
        total_amount: amount,
        paid_by: paidBy === 'you' ? null : paidBy,
        expense_date: expenseDate,
        split_type: splitType,
        participants: participantsPayload,
      });

      setAddExpenseOpen(false);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add expense';
      setError(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setAddExpenseOpen(false);
            navigate(-1);
          }}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-950 font-semibold text-sm p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h2 className="text-base font-bold text-slate-900">Add Expense</h2>
        <div className="w-9" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        {/* Description */}
        <Input
          label="Description *"
          placeholder="e.g. Dinner at Cafe, Grocery, Movie"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError('');
          }}
          autoFocus
        />

        {/* Amount */}
        <CurrencyInput
          label="Amount *"
          value={amount}
          onChange={(val) => {
            setAmount(val);
            setError('');
          }}
        />

        {/* Paid By */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Paid by
          </label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3.5 py-2.5 text-slate-900 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 min-h-[44px]"
          >
            <option value="you">You</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <Input
          type="date"
          label="Date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />

        {/* Participants Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Participants ({selectedParticipants.length})
            </label>
            <button
              type="button"
              onClick={() => setAddPersonOpen(true)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              + New Person
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* You Option */}
            <div
              onClick={() => toggleParticipant('you')}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                selectedParticipants.includes('you')
                  ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="text-xs truncate">You</span>
              {selectedParticipants.includes('you') && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>

            {/* People Options */}
            {people.map((p) => {
              const isSelected = selectedParticipants.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleParticipant(p.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xs truncate">{p.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Split Option: Equal vs Custom */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Split Method
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSplitType('equal')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                splitType === 'equal'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Equal Split
            </button>
            <button
              type="button"
              onClick={() => {
                // Initialize custom shares with equal split
                const initShares: Record<string, number> = {};
                selectedParticipants.forEach((id) => {
                  initShares[id] = equalSharesMap[id] || 0;
                });
                setCustomShares(initShares);
                setSplitType('custom');
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                splitType === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Split
            </button>
          </div>
        </div>

        {/* Split Shares Breakdown View */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-200/60">
            <span>Participant</span>
            <span>Share Amount</span>
          </div>

          {selectedParticipants.map((id) => {
            const name = id === 'you' ? 'You' : people.find((p) => p.id === id)?.name || 'Friend';
            const share = equalSharesMap[id] || 0;

            return (
              <div key={id} className="flex items-center justify-between text-sm py-1">
                <span className="font-medium text-slate-800">{name}</span>
                {splitType === 'equal' ? (
                  <span className="font-bold text-slate-900">{formatCurrency(share)}</span>
                ) : (
                  <div className="w-28">
                    <CurrencyInput
                      value={customShares[id] || 0}
                      onChange={(val) => handleCustomShareChange(id, val)}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Validation Status for Custom Split */}
          {splitType === 'custom' && (
            <div className="pt-2 border-t border-slate-200/60">
              {splitValidation.isValid ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Split matches total ({formatCurrency(amount)}) ✓</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{splitValidation.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full text-base py-3.5 shadow-md"
          isLoading={addExpenseMutation.isPending}
          disabled={amount <= 0 || (splitType === 'custom' && !splitValidation.isValid)}
        >
          Add Expense
        </Button>
      </form>
    </div>
  );
};
