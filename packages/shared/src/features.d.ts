export interface FeatureDefinition {
    key: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    category: 'sales' | 'purchases' | 'inventory' | 'crm' | 'finance' | 'reports' | 'tools' | 'settings';
    dependencies: string[];
    isBaseAvailable: boolean;
}
export declare const FEATURE_CATALOG: Record<string, FeatureDefinition>;
