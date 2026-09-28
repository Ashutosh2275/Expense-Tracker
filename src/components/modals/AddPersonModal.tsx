import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAddPerson } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';

export const AddPersonModal: React.FC = () => {
  const { isAddPersonOpen, setAddPersonOpen } = useUIStore();
  const addPersonMutation = useAddPerson();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNote('');
    setError('');
    setAddPersonOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      await addPersonMutation.mutateAsync({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
      });
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add person';
      setError(msg);
    }
  };

  return (
    <Modal isOpen={isAddPersonOpen} onClose={handleClose} title="Add Person">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name *"
          placeholder="e.g. Ashutosh"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          autoFocus
        />

        <Input
          type="email"
          label="Email (Optional)"
          placeholder="priya@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          type="tel"
          label="Phone (Optional)"
          placeholder="+91 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <Input
          label="Note (Optional)"
          placeholder="e.g. College friend, flatmate"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={addPersonMutation.isPending}
            disabled={!name.trim()}
          >
            Add Person
          </Button>
        </div>
      </form>
    </Modal>
  );
};
