/**
 * ORKA console banner
 * 사용법:
 *   import showOrkaConsoleBanner from "@/lib/consoleBanner";
 *   showOrkaConsoleBanner();
 */
export default function showOrkaConsoleBanner(): void {
  const art = `
  #######      ########      ###   ###      #####   
 #########     #########     ###  ###      #######  
 ###   ###     ###   ###     ### ###      ###   ### 
 ###   ###     ###   ###     ######       ###   ### 
 ###   ###     ########      #####        ######### 
 ###   ###     #######       ######       ######### 
 ###   ###     ### ###       ### ###      ###   ### 
 #########     ###  ###      ###  ###     ###   ### 
  #######      ###   ###     ###   ###    ###   ### 
`;

  const message = "웃어라,세상이 너와 함께 웃을 것이다";

  try {
    // 아스키 아트
    console.log(art);
    // 메시지
    console.log(message);
  } catch {
    /* noop */
  }
}
