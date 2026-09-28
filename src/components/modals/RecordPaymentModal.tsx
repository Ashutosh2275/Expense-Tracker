import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { usePeople, useRecordPayment } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { toISODateString } from '@/utils/date';
import { PaymentMethod } from '@/types/database';

export const RecordPaymentModal: React.FC = () => {
  const { isRecordPaymentOpen, closeRecordPayment, paymentPreselectedPersonId, paymentPreselectedExpenseId } =
    useUIStore();
  const { data: people = [] } = usePeople();
  const recordPaymentMutation = useRecordPayment();

  const [personId, setPersonId] = useState<string>('');
  const [direction, setDirection] = useState<'friend_paid_you' | 'you_paid_friend'>('friend_paid_you');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [date, setDate] = useState<string>(toISODateString());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isRecordPaymentOpen) {
      if (paymentPreselectedPersonId) {
        setPersonId(paymentPreselectedPersonId);
      } else if (people.length > 0 && !personId) {
        setPersonId(people[0].id);
      }
      setAmount(0);
      setDate(toISODateString());
      setNote('');
      setError('');
    }
  }, [isRecordPaymentOpen, paymentPreselectedPersonId, people]);

  const selectedPerson = people.find((p) => p.id === personId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personId) {
      setError('Please select a person');
      return;
    }
    if (amount <= 0) {
      setError('Amount must be greater than ₹0');
      return;
    }

    try {
      await recordPaymentMutation.mutateAsync({
        expense_id: paymentPreselectedExpenseId || null,
        from_person_id: direction === 'friend_paid_you' ? personId : null,
        to_person_id: direction === 'you_paid_friend' ? personId : null,
        amount,
        payment_method: method,
        payment_date: date,
        note: note.trim() || undefined,
      });

      closeRecordPayment();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record payment';
      setError(message);
    }
  };

  return (
    <Modal
      isOpen={isRecordPaymentOpen}
      onClose={closeRecordPayment}
      title="Record Payment"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Person Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Person *
          </label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            disabled={Boolean(paymentPreselectedPersonId)}
            className="w-full px-3.5 py-2.5 text-slate-900 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-h-[44px]"
          >
            {people.length === 0 ? (
              <option value="">No people available</option>
            ) : (
              people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Direction Toggle */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Payment Direction
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setDirection('friend_paid_you')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                direction === 'friend_paid_you'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {selectedPerson ? `${selectedPerson.name} paid you` : 'They paid you'}
            </button>
            <button
              type="button"
              onClick={() => setDirection('you_paid_friend')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all min-h-[40px] ${
                direction === 'you_paid_friend'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {selectedPerson ? `You paid ${selectedPerson.name}` : 'You paid them'}
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <CurrencyInput
          label="Amount *"
          value={amount}
          onChange={(val) => {
            setAmount(val);
            setError('');
          }}
          placeholder="0"
          autoFocus
        />

        {/* Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3.5 py-2.5 text-slate-900 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-h-[44px]"
          >
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Date */}
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* Note */}
        <Input
          type="text"
          label="Note (Optional)"
          placeholder="e.g. GPay transaction / settled dinner"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={closeRecordPayment}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={recordPaymentMutation.isPending}
            disabled={amount <= 0}
          >
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
