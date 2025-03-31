export interface MemberFormData {
  name: string;
  email: string;
  phone?: string;
  group_id: string;
}

export interface GroupFormData {
  name: string;
  description?: string;
}

export interface ExcelMemberData {
  name: string;
  email: string;
  phone?: string;
  group_id: number;
}

export interface SearchFilters {
  name: string;
  email: string;
  phone: string;
  group_id?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface SearchColumn {
  name: string;
  label: string;
  type: 'input' | 'select';
  placeholder?: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
  width?: number;
  allowClear?: boolean;
  onChange?: (value: any) => void;
}

export interface SearchFormProps {
  columns: SearchColumn[];
  onSearch: (values: Record<string, any>) => void;
  onReset: () => void;
  className?: string;
} 