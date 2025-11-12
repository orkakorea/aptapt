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

  const message = "내가 해냈다.장하다!";

  try {
    // 아스키 아트
    console.log(art);
    // 메시지
    console.log(message);
  } catch {
    /* noop */
  }
}
