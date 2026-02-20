export const EXPENSE_CATEGORIES = [
  'salarios',
  'alquiler',
  'servicios',
  'productos',
  'equipamiento',
  'marketing',
  'impuestos',
  'mantenimiento',
  'otros',
];

export const INCOME_CATEGORIES = [
  'servicios',
  'productos',
  'propinas',
  'gift_cards',
  'otros',
];

export interface GetCategoriesResult {
  income: string[];
  expense: string[];
}

export async function getCategories(): Promise<GetCategoriesResult> {
  return {
    income: INCOME_CATEGORIES,
    expense: EXPENSE_CATEGORIES,
  };
}
