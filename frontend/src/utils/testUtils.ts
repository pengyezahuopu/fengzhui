// Simple utility test to verify jest setup
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const calculatePrice = (basePrice: number, discount: number): number => {
  return basePrice - discount;
};
