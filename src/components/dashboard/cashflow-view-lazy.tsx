// Re-export der echten View. Der fr\u00fchere next/dynamic mit ssr:false hat
// im umgebenden Suspense ein BAILOUT_TO_CLIENT_SIDE_RENDERING getriggert,
// wodurch der Full-Screen-Loader h\u00e4ngen blieb.
export { CashflowView } from "./cashflow-view";
