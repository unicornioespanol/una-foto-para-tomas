const arrangements=[['abuela','tomas','lucia'],['tomas','lucia','abuela']];
export function ensureFamilyOrder(answers,random=Math.random){
  if(!arrangements.some(order=>order.every((id,i)=>answers.familyOrder?.[i]===id)))answers.familyOrder=[...arrangements[Math.min(1,Math.floor(random()*2))]];
  return answers.familyOrder;
}
