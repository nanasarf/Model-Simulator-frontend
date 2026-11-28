/** .NET decimal-compatible input. No economic calculations are performed here. */
export function decimalToken(input:string):string|null {
  const value=input.trim();if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))return null;
  let [whole,fraction='']=value.split('.');whole=(whole||'0').replace(/^0+(?=\d)/,'');fraction=fraction.replace(/0+$/,'');
  if(fraction.length>28||BigInt(whole+fraction)>79228162514264337593543950335n)return null;
  return whole+(fraction?'.'+fraction:'');
}
export function withinBounds(token:string,min:number,max:number){
  const [whole,fraction='']=token.split('.');const scale=10n**BigInt(fraction.length),value=BigInt(whole+fraction);
  // This protocol's input limits are integer-valued; fail closed on other schemas.
  return Number.isSafeInteger(min)&&Number.isSafeInteger(max)&&value>=BigInt(min)*scale&&value<=BigInt(max)*scale;
}
/** Retain exact numeric lexemes while JSON.parse supplies the contractual number types. */
export function numericTokens(source:string):Map<string,string>{
  const tokens=source.match(/"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g)??[];
  let index=0;const numbers=new Map<string,string>();
  function read(path:(string|number)[]):void{
    const token=tokens[index++];
    if(token==='{'){while(tokens[index]!=='}'){const key=JSON.parse(tokens[index++]) as string;index++;read([...path,key]);if(tokens[index]!==',')break;index++;}index++;}
    else if(token==='['){let element=0;while(tokens[index]!==']'){read([...path,element++]);if(tokens[index]!==',')break;index++;}index++;}
    else if(token&&/^-?\d/.test(token))numbers.set(JSON.stringify(path),token);
  }
  read([]);return numbers;
}
