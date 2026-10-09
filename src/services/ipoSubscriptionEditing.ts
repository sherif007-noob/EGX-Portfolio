/**
 * Convert an explicitly recorded local Cairo execution clock to a UTC ISO
 * instant using the IANA timezone, including Egypt's seasonal DST changes.
 * Never assume Cairo is permanently UTC+02 or UTC+03.
 */
export function cairoOrderTimeToUtcIso(dateKey: string, localTime: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
    throw new Error('Enter a valid subscription date and Cairo time (HH:MM).');
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const target = Date.UTC(year,month-1,day,hour,minute);
  if (!Number.isFinite(target) || new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==dateKey) {
    throw new Error('Invalid subscription calendar date.');
  }
  const formatter = new Intl.DateTimeFormat('en-GB',{
    timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  });
  const cairoParts = (milliseconds:number) => {
    const parts=formatter.formatToParts(new Date(milliseconds));
    const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
    return {year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute')};
  };
  let utc = target - 3 * 60 * 60 * 1000;
  for(let i=0;i<4;i++){
    const p=cairoParts(utc);
    const actual=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
    const diff=target-actual;
    if(diff===0)break;
    utc+=diff;
  }
  const result=cairoParts(utc);
  if(result.year!==year || result.month!==month || result.day!==day ||
    result.hour!==hour || result.minute!==minute) {
    throw new Error('That clock time does not exist in Cairo on the selected date (DST).');
  }
  return new Date(utc).toISOString();
}
