import React from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { useBalances } from '@/hooks/useData';
import { useUIStore } from '@/stores/uiStore';
import { PersonRow } from '@/components/domain/PersonRow';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export const PeoplePage: React.FC = () => {
  const { summary, isLoading } = useBalances();
  const { peopleSearchQuery, setPeopleSearchQuery, setAddPersonOpen } = useUIStore();

  const filteredPeople = summary.pendingPeople.filter((p) =>
    p.name.toLowerCase().includes(peopleSearchQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-12">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">People</h2>
          <p className="text-xs text-slate-500">
            {summary.pendingPeople.length} friends tracked
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddPersonOpen(true)}
          className="gap-1.5 shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Person</span>
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search people..."
          value={peopleSearchQuery}
          onChange={(e) => setPeopleSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-h-[44px]"
        />
      </div>

      {/* People List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : filteredPeople.length > 0 ? (
        <div className="space-y-2.5">
          {filteredPeople.map((person) => (
            <PersonRow key={person.personId} person={person} />
          ))}
        </div>
      ) : summary.pendingPeople.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No people yet"
          description="Add friends you regularly split food, travel, or bills with."
          actionLabel="+ Add Person"
          onAction={() => setAddPersonOpen(true)}
        />
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm">
          No matches found for "{peopleSearchQuery}"
        </div>
      )}
    </div>
  );
};
