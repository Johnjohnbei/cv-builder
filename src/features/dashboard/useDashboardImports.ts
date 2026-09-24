import { useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useAction, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { CVData } from '@/src/shared/types';
import type { useAccessCode } from '@/src/shared/hooks';
import { STORAGE_FAILED_MESSAGE, writeStoredText } from '@/src/shared/lib/storage';
import { detectCVLanguage } from '@/src/lib/language-detection';

// pdfjs (~450 kB) only loads when a PDF is actually dropped
const loadPdfTools = () => import('@/src/lib/pdf-text-extract');

/** PDFs above this size are refused at the drop zone, before any parsing */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

interface DashboardImportsDeps {
  user: unknown;
  isGuest: boolean;
  jobUrl: string;
  getCode: ReturnType<typeof useAccessCode>['getCode'];
  /** Runs the action once the visitor may use AI, asking for an access code first when needed */
  requireAccessCode: (action: () => void) => void;
  reportAIError: (error: unknown, fallback: string) => void;
  notify: (args: { message: string; type: 'success' | 'error' }) => void;
  setBaseCV: (cv: CVData) => void;
  setJobDescription: (text: string) => void;
}

/**
 * The imports of the dashboard: the CV PDF (LinkedIn parsed locally, any other
 * PDF read by the AI), the offer PDF and the offer URL. Extracted from
 * DashboardPage, over its size limit.
 */
export function useDashboardImports(deps: DashboardImportsDeps) {
  const { user, isGuest, jobUrl, getCode, requireAccessCode, reportAIError, notify, setBaseCV, setJobDescription } = deps;
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingJob, setIsExtractingJob] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);

  const storeUser = useMutation(api.users.store);
  const saveBaseCV = useMutation(api.users.saveBaseCV);
  const extractCVDataFromPDF = useAction(api.ai.extractCVDataFromPDF);
  const extractJobDescriptionFromURL = useAction(api.ai.extractJobDescriptionFromURL);
  const extractJobDescriptionFromPDF = useAction(api.ai.extractJobDescriptionFromPDF);

  /** A file the drop zone refused (not a PDF, too big) used to start the extraction anyway */
  const notifyRejectedFile = (rejections: FileRejection[]) => {
    const tooBig = rejections.some(r => r.errors.some(e => e.code === 'file-too-large'));
    notify({ message: tooBig ? 'Fichier trop volumineux : 10 Mo maximum.' : 'Fichier refusé : déposez un PDF.', type: 'error' });
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return; // refused files are reported by onDropRejected
    requireAccessCode(async () => {
      setIsUploading(true);
      try {
        const { extractTextFromPDF, parseLinkedInPDF } = await loadPdfTools();
        // LinkedIn format parsed locally first: instant, no API call
        const data = (await parseLinkedInPDF(file))
          // Sent whole: cut at 12 000 characters, a dense CV silently lost its
          // last experiences. The server refuses a text too long, with a message.
          ?? await extractCVDataFromPDF({ pdfText: await extractTextFromPDF(file), accessCode: getCode() });
        const imported = { ...data, detectedLanguage: detectCVLanguage(data) };
        setBaseCV(imported);

        // The import is the base the next offer is tailored from, not the draft
        // open in the editor: it must never overwrite that draft.
        if (user) {
          await storeUser();
          await saveBaseCV({ cvData: imported });
        } else if (isGuest && !writeStoredText('guest_base_cv', JSON.stringify(imported))) {
          notify({ message: STORAGE_FAILED_MESSAGE, type: 'error' });
        }
      } catch (error: any) {
        console.error('Extraction error:', error);
        if (error?.message === 'PDF_NO_TEXT') {
          notify({ message: 'Ce PDF semble être une image scannée. Veuillez utiliser un PDF généré depuis Word, Google Docs ou LinkedIn.', type: 'error' });
        } else {
          reportAIError(error, 'Erreur lors de l\'extraction du PDF. Assurez-vous que le fichier est lisible.');
        }
      } finally {
        setIsUploading(false);
      }
    });
  };

  const onJobDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return; // refused files are reported by onDropRejected
    requireAccessCode(async () => {
      setIsExtractingJob(true);
      try {
        const { extractTextFromPDF } = await loadPdfTools();
        const pdfText = await extractTextFromPDF(file);
        setJobDescription(await extractJobDescriptionFromPDF({ pdfText, accessCode: getCode() }));
      } catch (error: any) {
        console.error('Job extraction error:', error);
        if (error?.message === 'PDF_NO_TEXT') {
          notify({ message: 'Ce PDF semble être une image scannée. Veuillez copier-coller le texte manuellement.', type: 'error' });
        } else {
          reportAIError(error, 'Erreur lors de l\'extraction de la fiche de poste.');
        }
      } finally {
        setIsExtractingJob(false);
      }
    });
  };

  const cvDropzone = useDropzone({
    onDrop,
    onDropRejected: notifyRejectedFile,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_PDF_BYTES,
  });

  // PDF only: a .txt was accepted here, then failed inside pdf.js with a generic error
  const jobDropzone = useDropzone({
    onDrop: onJobDrop,
    onDropRejected: notifyRejectedFile,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_PDF_BYTES,
  });

  const crawlJobUrl = async () => {
    setIsCrawling(true);
    try {
      const text = await extractJobDescriptionFromURL({ url: jobUrl, accessCode: getCode() });
      if (!text || text.length < 50) {
        notify({ message: "Nous n'avons pas pu extraire suffisamment de contenu de cette URL. Les sites comme LinkedIn bloquent souvent l'accès direct : copiez-collez plutôt le texte de l'offre dans la zone prévue.", type: 'error' });
      } else {
        setJobDescription(text);
      }
    } catch (error) {
      console.error('Crawl error:', error);
      reportAIError(error, 'Erreur lors de la récupération de l\'offre via URL. Les sites protégés (comme LinkedIn) peuvent bloquer cette fonctionnalité.');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleUrlCrawl = () => {
    if (!jobUrl) return;
    requireAccessCode(() => { void crawlJobUrl(); });
  };

  return { isUploading, isExtractingJob, isCrawling, cvDropzone, jobDropzone, handleUrlCrawl };
}
