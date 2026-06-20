import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Fact } from '../data/sampleFacts';

interface UseFactsResult {
  facts: Fact[];
  loading: boolean;
  error: string | null;
}

export function useFacts(): UseFactsResult {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFacts() {
      const { data, error: err } = await supabase
        .from('facts')
        .select('*')
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(`Failed to load facts: ${err.message}`);
      } else {
        setFacts((data as Fact[]) ?? []);
      }
      setLoading(false);
    }

    fetchFacts();

    const channel = supabase
      .channel('facts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'facts' },
        (payload) => {
          if (!cancelled) setFacts((prev) => [...prev, payload.new as Fact]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'facts' },
        (payload) => {
          if (!cancelled)
            setFacts((prev) =>
              prev.map((f) => (f.id === (payload.new as Fact).id ? (payload.new as Fact) : f)),
            );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'facts' },
        (payload) => {
          if (!cancelled)
            setFacts((prev) => prev.filter((f) => f.id !== (payload.old as Fact).id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { facts, loading, error };
}
