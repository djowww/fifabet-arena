// Assigned ISO 3166-1 alpha-2 codes; snapshot reviewed on 2026-10-01.
// Compared with Unicode CLDR region validity, excluding its eight non-ISO extras.
// Source: https://github.com/unicode-org/cldr/blob/main/common/validity/region.xml
export const COUNTRY_CODES=Object.freeze(`
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`.trim().split(/\s+/));
const countrySet=new Set(COUNTRY_CODES);
const termsSources=new Set(['password','google','apple']);
export const TERMS_VERSION='2026-10-01';

export function normalizeCountry(value){
  if(typeof value!=='string')return null;
  const code=value.trim().toUpperCase();
  return countrySet.has(code)?code:null;
}

export function validTermsAcceptance(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.version!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.version)||!termsSources.has(value.source)||typeof value.acceptedAt!=='string')return false;
  const date=new Date(value.acceptedAt);
  return Number.isFinite(date.getTime())&&date.toISOString()===value.acceptedAt;
}

// Absence of the new marker identifies existing accounts; never invent their consent.
export function needsAccountOnboarding(user){
  return user?.signupVersion===1&&(user.onboardingRequired!==false||!normalizeCountry(user.countryCode)||!validTermsAcceptance(user.termsAcceptance));
}
