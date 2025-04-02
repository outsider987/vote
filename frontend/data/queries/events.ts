import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEventsAPI } from '@/api/events';
import type { Event } from '../types';
import { EventSearchFilters } from '../../app/vote/event/types';

export const eventsKeys = {
  all: ['events'] as const,
  list: () => [...eventsKeys.all] as const,
  detail: (id: string) => [...eventsKeys.all, id] as const,
};

export const useEvents = (initialFilters: EventSearchFilters = {}) => {
  const [filters, setFilters] = useState<EventSearchFilters>({
    page: 1,
    pageSize: 10,
    ...initialFilters
  });

  const eventsAPI = useEventsAPI();

  const queryResult = useQuery({
    queryKey: ["events", filters],
    queryFn: async () => {
      const response = await eventsAPI.GET_EVENTS(filters);
      return response.data;
    },
    staleTime: 30000,
  });

  const updateFilters = (newFilters: EventSearchFilters) => {
    
    setFilters((prevFilters) => ({
      ...prevFilters,
      ...newFilters,
      // Reset to page 1 if search criteria changes but not if just changing page
      ...(newFilters.hasOwnProperty('title') || newFilters.hasOwnProperty('status') || newFilters.hasOwnProperty('group_id')
          ? { page: 1 } 
          : {})
    }));
  };

  const handlePageChange = (page: number, pageSize?: number) => {
    updateFilters({ 
      page, 
      ...(pageSize ? { pageSize } : {})
    });
  };

  return {
    ...queryResult,
    data: queryResult.data || { data: [], total: 0, page: 1, pageSize: 10 },
    filters,
    updateFilters,
    handlePageChange,
  };
}; 