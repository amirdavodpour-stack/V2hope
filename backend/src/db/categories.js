const CATEGORY_CATALOG = [
  {slug:'technology', name:'فناوری', nameEn:'Technology', description:'توسعه نرم‌افزار، داده، هوش مصنوعی و زیرساخت.', order:10},
  {slug:'software-development', name:'توسعه نرم‌افزار', nameEn:'Software Development', parent:'technology', order:11},
  {slug:'frontend', name:'توسعه فرانت‌اند', nameEn:'Frontend Development', parent:'software-development', order:12},
  {slug:'backend', name:'توسعه بک‌اند', nameEn:'Backend Development', parent:'software-development', order:13},
  {slug:'mobile', name:'توسعه موبایل', nameEn:'Mobile Development', parent:'software-development', order:14},
  {slug:'fullstack', name:'توسعه فول‌استک', nameEn:'Full-stack Development', parent:'software-development', order:15},
  {slug:'devops', name:'DevOps و زیرساخت', nameEn:'DevOps & Infrastructure', parent:'technology', order:16},
  {slug:'ai-data', name:'هوش مصنوعی و داده', nameEn:'AI & Data', parent:'technology', order:17},
  {slug:'design', name:'طراحی', nameEn:'Design', description:'طراحی محصول، تجربه کاربری و محتوای بصری.', order:20},
  {slug:'uiux', name:'UI/UX', nameEn:'UI/UX Design', parent:'design', order:21},
  {slug:'graphic', name:'طراحی گرافیک', nameEn:'Graphic Design', parent:'design', order:22},
  {slug:'motion', name:'موشن و ویدئو', nameEn:'Motion & Video', parent:'design', order:23},
  {slug:'content', name:'محتوا و ترجمه', nameEn:'Content & Translation', description:'نویسندگی، ویراستاری، تولید محتوا و ترجمه.', order:30},
  {slug:'writing', name:'نویسندگی', nameEn:'Writing', parent:'content', order:31},
  {slug:'translation', name:'ترجمه', nameEn:'Translation', parent:'content', order:32},
  {slug:'marketing', name:'بازاریابی', nameEn:'Marketing', description:'دیجیتال مارکتینگ، رشد، برند و شبکه‌های اجتماعی.', order:40},
  {slug:'sales', name:'فروش', nameEn:'Sales', order:50},
  {slug:'finance', name:'مالی و حسابداری', nameEn:'Finance & Accounting', order:60},
  {slug:'education', name:'آموزش', nameEn:'Education', order:70},
  {slug:'research', name:'پژوهش', nameEn:'Research', order:80},
  {slug:'services', name:'خدمات', nameEn:'Services', order:90},
  {slug:'healthcare', name:'پزشکی و سلامت', nameEn:'Healthcare', parent:'services', order:91},
  {slug:'transport', name:'حمل‌ونقل', nameEn:'Transport', parent:'services', order:92},
];


export { CATEGORY_CATALOG };
