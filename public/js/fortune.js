/* Trải bài và xem tuổi mang tính chiêm nghiệm; xăm được máy chủ điều phối. */
(function (root) {
  'use strict';
  const lots = [
    ['Thượng cát','Mây tan trăng tỏ','Việc đang chờ có thể dần sáng rõ. Kiên nhẫn, giữ lời hứa và đón nhận sự giúp đỡ.'],
    ['Trung cát','Gieo hạt chờ mùa','Điều tốt cần thời gian vun trồng. Hãy bắt đầu bằng một việc nhỏ, làm đều đặn.'],
    ['Bình hòa','Nước lặng soi lòng','Chưa cần vội quyết định. Lắng nghe và kiểm tra thông tin trước khi tiến bước.'],
    ['Tiểu cát','Gió thuận căng buồm','Một cơ hội mới có thể đến qua giao tiếp. Chủ động hỏi và chuẩn bị kỹ.'],
    ['Trung bình','Qua cầu từng bước','Đường đi có trở ngại nhỏ. Chia việc thành từng bước, tránh ôm đồm.'],
    ['Cát','Hoa nở đúng mùa','Công sức đang tích lũy; tiếp tục chăm chút và trân trọng người đồng hành.'],
    ['Bình hòa','Núi cao có lối','Nếu gặp khó, hãy tìm thêm góc nhìn và nhờ người tin cậy góp ý.'],
    ['Tiểu cát','Đèn sáng trong đêm','Một ý tưởng hữu ích có thể đến khi bạn nghỉ ngơi và nhìn lại.'],
    ['Trung cát','Sen nở giữa hồ','Giữ sự điềm tĩnh khi trò chuyện sẽ giúp tháo gỡ hiểu lầm.'],
    ['Bình hòa','Mưa qua trời tạnh','Thay đổi có thể khiến bạn bối rối. Dành thời gian thích nghi, không ép bản thân.'],
    ['Cát','Bạn hiền gặp gỡ','Hợp tác và sự chân thành mở ra cơ hội học hỏi cho đôi bên.'],
    ['Tiểu cát','Sớm mai chim hót','Hãy sắp xếp lại ưu tiên và bắt đầu ngày mới với một mục tiêu vừa sức.']
  ];
  const chi=['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
  const can=['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý'];
  const groups=[[0,4,8],[1,5,9],[2,6,10],[3,7,11]];
  const mod=(n,m)=>(n%m+m)%m;
  function relation(a,b) {
    if(a===b) return 'trùng địa chi: nên chú ý điều chỉnh nhịp sinh hoạt và nhìn lại ưu tiên';
    if(mod(a-b,12)===6) return 'lục xung: nên thận trọng với thay đổi, dành thêm thời gian đối thoại';
    if(groups.some(g=>g.includes(a)&&g.includes(b))) return 'tam hợp: thuận để kết nối, hợp tác và chủ động trao đổi';
    return 'không thuộc cặp tam hợp hoặc lục xung trong cách xem này: giữ nhịp ổn định và theo dõi hoàn cảnh';
  }
  function text(el,value) { el.textContent=value; }
  function init({socket, getMe, getJoined, setScene, getScene, toast, getNow}) {
    const now=()=>getNow?getNow():Date.now();
    const $=id=>document.getElementById(id), dlg=$('dlg-fortune'); let state={current:null,waiting:[]};
    const open=type=>{ if(!getJoined()){toast('Mời bạn vào chùa trước nhé.');return;} $('fortune-lot').hidden=type!=='lot';$('fortune-tarot').hidden=type!=='tarot';$('fortune-horoscope').hidden=type!=='horoscope';text($('fortune-title'),type==='lot'?'Xin xăm':type==='tarot'?'Trải bài Tarot':'Xem tử vi sắp tới');if(type==='tarot')tarot.open();else tarot.stop();if(type==='lot'){renderQueue();startTick();}else stopTick();if(!dlg.open)dlg.showModal();};
    $('fortune-close').onclick=()=>dlg.close();
    // đổi cảnh (chánh điện, sân chùa, Tàng Kinh Các) do thanh đổi map lo (public/js/mapbar.js, app.js: goMap)
    $('fortune-join').onclick=()=>socket.emit('fortune:join',{},r=>{if(!r||!r.ok)toast(r?.reason||'Chưa thể xin xăm.');else $('lot-result').hidden=true;});
    $('fortune-leave').onclick=()=>socket.emit('fortune:leave');
    function renderQueue() {
      const me=getMe(), current=state.current, idx=state.waiting.findIndex(x=>x.id===me), active=current?.id===me, pending=active||idx>=0;
      $('fortune-join').hidden=pending; $('fortune-leave').hidden=!pending;
      text($('fortune-status'),current?`${current.name} đang xin xăm · ${Math.max(0,Math.ceil((current.endsAt-now())/1000))} giây`:'Hũ xăm đang rảnh.');
      text($('fortune-wait'),idx>=0?`Bạn đang chờ ở vị trí ${idx+1} / ${state.waiting.length}.`:state.waiting.length?`${state.waiting.length} người đang chờ.`:'Chưa có ai chờ.');
    }
    socket.on('fortune:queue',s=>{state=s;renderQueue();});
    socket.on('fortune:result',({number})=>{const l=lots[number-1];if(!l)return;text($('lot-result'),`Quẻ ${number} · ${l[0]} — ${l[1]}\n${l[2]}`);$('lot-result').hidden=false;toast(`Bạn đã xin được quẻ số ${number}.`);if(getScene()==='hall')open('lot');});
    // đếm ngược chỉ chạy khi hộp đang mở; dùng giờ máy chủ (endsAt là giờ máy chủ)
    let tick=0;
    const startTick=()=>{if(!tick)tick=setInterval(renderQueue,250);};
    const stopTick=()=>{clearInterval(tick);tick=0;};
    dlg.addEventListener('close',()=>{stopTick();tarot.stop();});
    // tarot theo chủ đề: toàn bộ giao diện ở public/js/tarot.js
    const tarot=Tarot.init({root:$('tarot-app'),socket,toast});
    $('horoscope-form').onsubmit=e=>{
      e.preventDefault();const val=$('birthdate').value, m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(val);if(!m)return;
      const [y,month,day]=m.slice(1).map(Number), date=new Date(Date.UTC(y,month-1,day));
      if(y<1900||date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||date.getTime()>Date.now()){text($('horoscope-result'),'Vui lòng chọn ngày sinh hợp lệ từ năm 1900 đến hôm nay.');return;}
      const lunar=Lunar.toLunar(day,month,y), birth=mod(lunar[2]+8,12), today=new Date(Date.now()+7*3600000);let out=`Ngày sinh âm lịch: ${lunar[0]}/${lunar[1]}${lunar[3]?' nhuận':''}/${lunar[2]} · Năm ${can[mod(lunar[2]+6,10)]} ${chi[birth]}.\n`;
      let last='';for(let i=0,found=0;i<100&&found<3;i++){const d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+i));const l=Lunar.toLunar(d.getUTCDate(),d.getUTCMonth()+1,d.getUTCFullYear());const key=`${l[2]}-${l[1]}-${l[3]}`;if(key===last)continue;last=key;const b=mod(l[1]+1,12);out+=`\nTháng ${l[1]}${l[3]?' nhuận':''} âm lịch (chi ${chi[b]}): ${relation(birth,b)}.`;found++;}
      out+='\n\nCách xem: đối chiếu địa chi năm sinh với địa chi ba tháng âm lịch; chưa lập lá số Tử Vi Đẩu Số hay an sao.';text($('horoscope-result'),out);$('horoscope-result').hidden=false;
    };
    return {open, reset(queue){state=queue||{current:null,waiting:[]};setScene('hall');renderQueue();}};
  }
  root.Fortune={init};
})(window);
