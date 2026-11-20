import "server-only";

export function generateDemoReply(message: string): string {
  const text = message.toLowerCase();

  if (/(hello|hi\b|হ্যালো|আসসালামু|সালাম)/i.test(text)) {
    return "স্বাগতম! আমি NEXORA AI Demo Assistant। আপনার ব্যবসার কোন বিষয়ে সাহায্য প্রয়োজন?";
  }

  if (/(order|অর্ডার|ডেলিভারি|delivery|শিপিং)/i.test(text)) {
    return "অর্ডার সংক্রান্ত বিষয়ে সাহায্য করতে পারি। অর্ডারের নম্বর, বর্তমান অবস্থা এবং প্রয়োজনীয় তথ্য জানালে আমি পরবর্তী পদক্ষেপ সাজিয়ে দিতে পারব। এটি একটি Demo AI উত্তর।";
  }

  if (/(product|পণ্য|স্টক|inventory|দাম|price)/i.test(text)) {
    return "পণ্য ও স্টক ব্যবস্থাপনায় সাহায্য করতে পারি। পণ্যের নাম, SKU অথবা স্টকের তথ্য দিন। এটি একটি Demo AI উত্তর; লাইভ inventory পরিবর্তন করে না।";
  }

  if (/(customer|কাস্টমার|গ্রাহক)/i.test(text)) {
    return "গ্রাহক ব্যবস্থাপনায় সাহায্য করতে পারি। আপনি customer communication, follow-up অথবা customer record সম্পর্কে কী জানতে চান?";
  }

  if (/(help|সাহায্য|কি করতে|কী করতে)/i.test(text)) {
    return "আমি Demo mode-এ কাজ করছি। আপনি অর্ডার, পণ্য, স্টক, গ্রাহক এবং ব্যবসায়িক যোগাযোগ নিয়ে প্রশ্ন করতে পারেন। বাস্তব AI provider এখনো সংযুক্ত নয়।";
  }

  return "আপনার বার্তাটি পেয়েছি। আমি NEXORA AI-এর Demo Reply Engine ব্যবহার করছি। আরও নির্দিষ্টভাবে প্রশ্ন করলে প্রাসঙ্গিক demo উত্তর দিতে পারব। বাস্তব AI model এখনো সংযুক্ত করা হয়নি।";
}
