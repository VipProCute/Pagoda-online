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
  // 22 lá Ẩn chính: từ khóa xuôi và ngược được diễn giải độc lập.
  const major = [
    ['The Fool','khởi đầu, cởi mở','bốc đồng, thiếu chuẩn bị'],['The Magician','chủ động, vận dụng năng lực','phân tán, chưa tận dụng nguồn lực'],['The High Priestess','trực giác, lắng nghe','bỏ qua cảm nhận, thông tin chưa rõ'],['The Empress','nuôi dưỡng, sáng tạo','kiệt sức, cần chăm sóc bản thân'],['The Emperor','cấu trúc, trách nhiệm','cứng nhắc, kiểm soát quá mức'],['The Hierophant','truyền thống, học hỏi','xem lại quy tắc, tìm cách riêng'],['The Lovers','lựa chọn, kết nối','lệch giá trị, cần đối thoại'],['The Chariot','ý chí, tiến lên','mất phương hướng, cần điều chỉnh'],['Strength','kiên nhẫn, nội lực','nghi ngờ bản thân, cần dịu dàng'],['The Hermit','chiêm nghiệm, tìm hiểu','cô lập, cần tìm sự hỗ trợ'],['Wheel of Fortune','chu kỳ thay đổi','chống lại thay đổi, chậm nhịp'],['Justice','cân bằng, chịu trách nhiệm','thiếu công bằng, cần xem lại dữ kiện'],['The Hanged Man','góc nhìn mới, tạm dừng','trì hoãn, khó buông bỏ'],['Death','kết thúc một giai đoạn, chuyển hóa','níu giữ điều cũ, khó chuyển tiếp'],['Temperance','điều độ, dung hòa','mất cân bằng, nóng vội'],['The Devil','ràng buộc, thói quen','nhận ra và tháo gỡ ràng buộc'],['The Tower','biến động, thay đổi cấu trúc','né tránh thay đổi, căng thẳng tích tụ'],['The Star','hy vọng, hồi phục','nản lòng, cần lấy lại niềm tin'],['The Moon','mơ hồ, tiềm thức','dần sáng tỏ, đối diện nỗi lo'],['The Sun','niềm vui, sáng tỏ','lạc quan bị che khuất, kỳ vọng quá mức'],['Judgement','thức tỉnh, nhìn lại','tự phê phán, chần chừ'],['The World','hoàn thành, hội nhập','chưa khép lại, cần hoàn tất']
  ].map(([name,up,rev])=>({name,up,rev}));
  const minor = [
    ['Wands',[
      ['cảm hứng và khởi đầu sáng tạo','thiếu động lực hoặc trì hoãn'],['lập kế hoạch và nhìn xa','sợ thay đổi, kế hoạch thiếu rõ ràng'],['mở rộng và chờ kết quả','trở ngại trong mở rộng'],['vui mừng, nền tảng vững','bất hòa, sự ổn định bị xáo trộn'],['cạnh tranh, khác biệt ý kiến','tránh xung đột hoặc tìm cách hòa giải'],['được ghi nhận, tiến bộ','thiếu tự tin hoặc thành công bị trì hoãn'],['bảo vệ lập trường','kiệt sức hoặc khó giữ vị trí'],['tin tức đến nhanh, tiến triển','chậm trễ, thông tin rối'],['bền bỉ trước thử thách','mệt mỏi, phòng thủ quá mức'],['gánh nhiều trách nhiệm','quá tải, cần chia sẻ gánh nặng'],['tò mò, tin về ý tưởng mới','ý tưởng thiếu hướng đi'],['nhiệt huyết và hành động','hấp tấp, dễ bỏ dở'],['tự tin và sáng tạo','tự nghi ngờ hoặc nóng nảy'],['tầm nhìn và lãnh đạo','độc đoán, kỳ vọng thiếu thực tế']
    ]],['Cups',[
      ['cảm xúc mới, lòng yêu thương','cảm xúc bị kìm nén'],['kết nối, quan hệ tương hỗ','bất hòa, thiếu cân bằng'],['tình bạn và cùng chia vui','xa cách hoặc vui quá mức'],['thờ ơ, suy ngẫm về lựa chọn','mở lòng với cơ hội'],['mất mát, tiếc nuối','chấp nhận, dần hồi phục'],['kỷ niệm và sự thân thuộc','mắc kẹt trong quá khứ'],['nhiều lựa chọn, mơ tưởng','nhìn rõ ưu tiên hơn'],['rời điều không còn phù hợp','ngại buông bỏ hoặc quay lại'],['mãn nguyện, mong muốn đạt được','chưa hài lòng hoặc thỏa mãn bề ngoài'],['hòa hợp và gắn bó','bất hòa trong mối quan hệ'],['thông điệp tình cảm, trực giác','nhạy cảm quá mức, thiếu chín chắn'],['lời mời, lãng mạn, theo đuổi lý tưởng','ảo tưởng, cảm xúc thất thường'],['đồng cảm và trực giác','ranh giới cảm xúc chưa rõ'],['cân bằng cảm xúc, bao dung','khó điều tiết cảm xúc']
    ]],['Swords',[
      ['sự thật, tư duy sáng rõ','nhầm lẫn, thông tin thiếu rõ ràng'],['bế tắc, cần lựa chọn','trì hoãn hoặc dần đưa ra quyết định'],['đau lòng và sự thật khó chấp nhận','chữa lành, đối diện nỗi buồn'],['nghỉ ngơi, hồi phục','kiệt sức hoặc khó nghỉ ngơi'],['xung đột và cái giá của thắng thua','mong hòa giải hoặc mâu thuẫn kéo dài'],['chuyển tiếp, rời giai đoạn khó','chưa thể buông chuyện cũ'],['chiến lược, cần xem xét sự trung thực','sự thật lộ ra, xem lại cách làm'],['cảm giác bị ràng buộc','nhận ra lựa chọn, tìm lối thoát'],['lo âu và suy nghĩ lặp lại','tìm hỗ trợ hoặc lo lắng kéo dài'],['kết thúc đau đớn','hồi phục hoặc chống lại kết thúc'],['tò mò, tìm hiểu sự thật','giao tiếp vội, thông tin chưa kiểm chứng'],['quyết liệt và nhanh chóng','bốc đồng, thiếu cân nhắc'],['thẳng thắn và minh bạch','phán xét, thiếu mềm mỏng'],['lý trí và công bằng','lạnh lùng, dùng lý trí cứng nhắc']
    ]],['Pentacles',[
      ['cơ hội vật chất hoặc công việc mới','bỏ lỡ cơ hội, thiếu kế hoạch'],['cân đối nhiều việc','quá tải, khó quản lý thời gian'],['học nghề và hợp tác','thiếu phối hợp hoặc kỹ năng'],['giữ gìn nguồn lực','bám chặt hoặc chi tiêu thiếu kiểm soát'],['khó khăn và cảm giác thiếu hỗ trợ','dần hồi phục, tìm được giúp đỡ'],['chia sẻ, cho và nhận','mất cân bằng hoặc điều kiện ràng buộc'],['kiên nhẫn đánh giá thành quả','nản chí, cần xem lại đầu tư'],['rèn kỹ năng và chăm chỉ','làm qua loa hoặc cầu toàn'],['tự chủ, tận hưởng thành quả','phụ thuộc hoặc đánh đổi quá nhiều'],['gia đình và nền tảng dài hạn','bất ổn nền tảng hoặc tranh chấp'],['học hỏi cơ hội thực tế','thiếu tập trung hoặc thiếu chuẩn bị'],['kiên trì và trách nhiệm','trì trệ, làm việc máy móc'],['chăm sóc thực tế và đủ đầy','bỏ bê bản thân hoặc mất cân đối'],['quản lý nguồn lực vững vàng','cứng nhắc hoặc quá coi trọng vật chất']
    ]]
  ];
  const ranks=['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Page','Knight','Queen','King'];
  const deck = major.concat(minor.flatMap(([suit,cards])=>cards.map(([up,rev],i)=>({name:`${ranks[i]} of ${suit}`,up,rev}))));
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
  function init({socket, getMe, getJoined, setScene, toast}) {
    const $=id=>document.getElementById(id), dlg=$('dlg-fortune'); let state={current:null,waiting:[]}, currentScene='hall';
    const open=type=>{ if(!getJoined()){toast('Mời bạn vào chùa trước nhé.');return;} $('fortune-lot').hidden=type!=='lot';$('fortune-tarot').hidden=type!=='tarot';$('fortune-horoscope').hidden=type!=='horoscope';text($('fortune-title'),type==='lot'?'Xin xăm':type==='tarot'?'Trải bài Tarot':'Xem tử vi sắp tới');if(!dlg.open)dlg.showModal();};
    $('fortune-close').onclick=()=>dlg.close();
    $('go-yard').onclick=()=>change('yard'); $('go-hall').onclick=()=>change('hall');
    function change(scene) { if(!getJoined()){toast('Mời bạn vào chùa trước nhé.');return;} socket.emit('scene',scene,r=>{if(!r||!r.ok)return;currentScene=scene;setScene(scene);$('go-yard').hidden=scene==='yard';$('go-hall').hidden=scene==='hall';$('stage').setAttribute('aria-label',scene==='hall'?'Chánh điện':'Sân chùa');}); }
    $('fortune-join').onclick=()=>socket.emit('fortune:join',{},r=>{if(!r||!r.ok)toast(r?.reason||'Chưa thể xin xăm.');else $('lot-result').hidden=true;});
    $('fortune-leave').onclick=()=>socket.emit('fortune:leave');
    function renderQueue() {
      const me=getMe(), current=state.current, idx=state.waiting.findIndex(x=>x.id===me), active=current?.id===me, pending=active||idx>=0;
      $('fortune-join').hidden=pending; $('fortune-leave').hidden=!pending;
      text($('fortune-status'),current?`${current.name} đang xin xăm · ${Math.max(0,Math.ceil((current.endsAt-Date.now())/1000))} giây`:'Hũ xăm đang rảnh.');
      text($('fortune-wait'),idx>=0?`Bạn đang chờ ở vị trí ${idx+1} / ${state.waiting.length}.`:state.waiting.length?`${state.waiting.length} người đang chờ.`:'Chưa có ai chờ.');
    }
    socket.on('fortune:queue',s=>{state=s;renderQueue();});
    socket.on('fortune:result',({number})=>{const l=lots[number-1];if(!l)return;text($('lot-result'),`Quẻ ${number} · ${l[0]} — ${l[1]}\n${l[2]}`);$('lot-result').hidden=false;toast(`Bạn đã xin được quẻ số ${number}.`);if(currentScene==='hall')open('lot');});
    setInterval(renderQueue,250);
    $('tarot-form').onsubmit=e=>{
      e.preventDefault();const pool=deck.slice(), picks=[];
      for(let i=0;i<3;i++){const index=Math.floor(Math.random()*pool.length);picks.push({...pool.splice(index,1)[0], reversed:Math.random()<.5});}
      const wrap=$('tarot-result');wrap.replaceChildren();
      picks.forEach((card,i)=>{const article=document.createElement('article'), title=document.createElement('strong'), body=document.createElement('p');title.textContent=`${['Quá khứ','Hiện tại','Khả năng sắp tới'][i]} · ${card.name} (${card.reversed?'ngược':'xuôi'})`;body.textContent=card.reversed?card.rev:card.up;article.append(title,body);wrap.append(article);});wrap.hidden=false;
    };
    $('horoscope-form').onsubmit=e=>{
      e.preventDefault();const val=$('birthdate').value, m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(val);if(!m)return;
      const [y,month,day]=m.slice(1).map(Number), date=new Date(Date.UTC(y,month-1,day));
      if(y<1900||date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||date.getTime()>Date.now()){text($('horoscope-result'),'Vui lòng chọn ngày sinh hợp lệ từ năm 1900 đến hôm nay.');return;}
      const lunar=Lunar.toLunar(day,month,y), birth=mod(lunar[2]+8,12), today=new Date(Date.now()+7*3600000);let out=`Ngày sinh âm lịch: ${lunar[0]}/${lunar[1]}${lunar[3]?' nhuận':''}/${lunar[2]} · Năm ${can[mod(lunar[2]+6,10)]} ${chi[birth]}.\n`;
      let last='';for(let i=0,found=0;i<100&&found<3;i++){const d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+i));const l=Lunar.toLunar(d.getUTCDate(),d.getUTCMonth()+1,d.getUTCFullYear());const key=`${l[2]}-${l[1]}-${l[3]}`;if(key===last)continue;last=key;const b=mod(l[1]+1,12);out+=`\nTháng ${l[1]}${l[3]?' nhuận':''} âm lịch (chi ${chi[b]}): ${relation(birth,b)}.`;found++;}
      out+='\n\nCách xem: đối chiếu địa chi năm sinh với địa chi ba tháng âm lịch; chưa lập lá số Tử Vi Đẩu Số hay an sao.';text($('horoscope-result'),out);$('horoscope-result').hidden=false;
    };
    return {open, reset(queue){state=queue||{current:null,waiting:[]};currentScene='hall';setScene('hall');$('go-yard').hidden=false;$('go-hall').hidden=true;renderQueue();}};
  }
  root.Fortune={init};
})(window);
