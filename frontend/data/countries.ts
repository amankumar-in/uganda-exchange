/**
 * Countries data using country-state-city library
 * No hardcoded data - everything comes from the library
 */

import { Country, ICountry } from 'country-state-city';

export interface CountryData {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
}

// Get all countries from library
const allCountries = Country.getAllCountries();

// Transform to our format
export const countries: CountryData[] = allCountries.map((country: ICountry) => ({
  code: country.isoCode,
  name: country.name,
  flag: country.flag || '',
  phoneCode: country.phonecode || '',
}));

// Get country options for Select component (for residence)
// Priority countries appear first (US, UK, Uganda, China)
export const getCountryOptions = () => {
  const priorityCodes = ['UG', 'US', 'GB', 'CN'];
  
  return [...countries]
    .sort((a, b) => {
      // Priority countries first
      const aPriority = priorityCodes.indexOf(a.code);
      const bPriority = priorityCodes.indexOf(b.code);
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Then sort alphabetically by country name
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      value: c.code,
      label: `${c.flag} ${c.name}`,
      searchValue: `${c.name} ${c.code}`,
    }));
};

// Get phone code options for Select component
export const getPhoneCodeOptions = () => {
  // Show all countries with their phone codes (no deduplication)
  const priorityCodes = ['UG', 'US', 'CA', 'GB', 'AU'];
  
  return countries
    .filter((c) => c.phoneCode && c.phoneCode.length > 0)
    .sort((a, b) => {
      // Priority countries first
      const aPriority = priorityCodes.indexOf(a.code);
      const bPriority = priorityCodes.indexOf(b.code);
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Then sort alphabetically by country name
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({
      value: c.code, // Use country code as value to uniquely identify
      label: `${c.flag} +${c.phoneCode} (${c.code})`,
      searchValue: `${c.name} ${c.code} ${c.phoneCode}`,
      phoneCode: c.phoneCode, // Include phone code for later use
    }));
};

// Get country by code
export const getCountryByCode = (code: string): CountryData | undefined =>
  countries.find((c) => c.code === code);

// Get country by phone code
export const getCountryByPhoneCode = (phoneCode: string): CountryData | undefined =>
  countries.find((c) => c.phoneCode === phoneCode);

// Get country with full library data
export const getFullCountryData = (code: string) => Country.getCountryByCode(code);
