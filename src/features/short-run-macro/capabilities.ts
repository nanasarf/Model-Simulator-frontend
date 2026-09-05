export const macroCapabilities = {
  fiscal: 'MACRO_SET_FISCAL_POLICY', monetary: 'MACRO_SET_MONETARY_POLICY', business: 'MACRO_SET_BUSINESS_STRATEGY', household: 'MACRO_SET_HOUSEHOLD_LABOR_STANCE',
  prediction: 'MACRO_SUBMIT_PREDICTION', shock: 'MACRO_TRIGGER_SHOCK', viewFiscal: 'MACRO_VIEW_FISCAL', viewMonetary: 'MACRO_VIEW_MONETARY', viewBusiness: 'MACRO_VIEW_BUSINESS', viewHousehold: 'MACRO_VIEW_HOUSEHOLD', viewAll: 'MACRO_VIEW_ALL',
} as const;
