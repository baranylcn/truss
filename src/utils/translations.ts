import { LanguageCode } from '../hooks/useLanguage';

const databaseStorageLimitReached = {
  en: 'Sorry, the database storage limit has been reached. Please try again later.',
  tr: 'Üzgünüz, veritabanı depolama limitine ulaşıldı. Lütfen daha sonra tekrar deneyiniz.',
  ku: 'Bibore, sînorê hilanîna danegiran gihîştiye. Ji kerema xwe paşê dîsa biceribîne.',
  de: 'Entschuldigung, die Datenbankspeichergrenze wurde erreicht. Bitte versuchen Sie es später erneut.',
  es: 'Lo sentimos, se ha alcanzado el límite de almacenamiento de la base de datos. Por favor, inténtelo más tarde.',
  ru: 'Извините, достигнут лимит хранилища базы данных. Пожалуйста, попробуйте позже.',
  fr: "Désolé, la limite de stockage de la base de données a été atteinte. Veuillez réessayer plus tard.",
  it: 'Spiacenti, è stato raggiunto il limite di archiviazione del database. Riprova più tardi.',
};

const databaseErrorGeneral = {
  en: 'Sorry, we cannot complete your request at this time. Please try again later.',
  tr: 'Üzgünüz, işleminizi şu anda gerçekleştiremiyoruz. Lütfen daha sonra tekrar deneyiniz.',
  ku: 'Bibore, em nikarîn daxwaza te niha temam bikin. Ji kerema xwe paşê dîsa biceribîne.',
  de: 'Entschuldigung, wir können Ihre Anfrage derzeit nicht bearbeiten. Bitte versuchen Sie es später erneut.',
  es: 'Lo sentimos, no podemos completar su solicitud en este momento. Por favor, inténtelo más tarde.',
  ru: 'Извините, мы не можем выполнить ваш запрос в данный момент. Пожалуйста, попробуйте позже.',
  fr: 'Désolé, nous ne pouvons pas traiter votre demande pour le moment. Veuillez réessayer plus tard.',
  it: 'Spiacenti, al momento non possiamo completare la tua richiesta. Riprova più tardi.',
};

export const getErrorMessage = (errorType: 'storageLimit' | 'general'): string => {
  const savedLang = localStorage.getItem('GroveML-language') as LanguageCode;
  const lang = savedLang || 'en';

  if (errorType === 'storageLimit') {
    return databaseStorageLimitReached[lang] || databaseStorageLimitReached.en;
  }

  return databaseErrorGeneral[lang] || databaseErrorGeneral.en;
};
