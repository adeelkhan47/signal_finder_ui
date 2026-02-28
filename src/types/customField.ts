export interface CustomFieldData {
  id: number;
  code: string;
  custom_field_1: string;
  custom_field_2: string;
  custom_field_3: string;
}

export interface EditCustomFieldPayload {
  custom_field_1: string;
  custom_field_2: string;
  custom_field_3: string;
}
