import { SearchColumn, SearchFormProps } from "../member/types";

export interface EventSearchFilters {
  title?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface EventSearchColumn extends SearchColumn {
  name: 'title' | 'status' | 'page' | 'pageSize';
}

export interface EventSearchFormProps extends SearchFormProps {
  columns: EventSearchColumn[];
  onSearch: (values: EventSearchFilters) => void;
}

export interface PaginationParams {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
} 