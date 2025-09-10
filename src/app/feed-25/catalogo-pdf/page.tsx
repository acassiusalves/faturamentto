
"use client";

import React from 'react';

// Teste 1: Imports básicos do React e Next
console.log('✅ React:', React);

// Teste 2: Imports de UI components
try {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } = require('@/components/ui/card');
  console.log('✅ Card components:', { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter });
} catch (error) {
  console.error('❌ Card components error:', error);
}

try {
  const { Button } = require('@/components/ui/button');
  console.log('✅ Button:', Button);
} catch (error) {
  console.error('❌ Button error:', error);
}

try {
  const { Input } = require('@/components/ui/input');
  console.log('✅ Input:', Input);
} catch (error) {
  console.error('❌ Input error:', error);
}

try {
  const { Label } = require('@/components/ui/label');
  console.log('✅ Label:', Label);
} catch (error) {
  console.error('❌ Label error:', error);
}

// Teste 3: Imports de ícones do Lucide
try {
  const { 
    BookImage, 
    Loader2, 
    Upload, 
    FileText, 
    XCircle, 
    ChevronLeft, 
    ChevronRight, 
    Play, 
    FastForward, 
    Search, 
    Wand2, 
    ChevronsLeft, 
    ChevronsRight, 
    PackageSearch, 
    TrendingUp,
    ExternalLink
  } = require('lucide-react');
  
  console.log('✅ Lucide icons:', { 
    BookImage, 
    Loader2, 
    Upload, 
    FileText, 
    XCircle, 
    ChevronLeft, 
    ChevronRight, 
    Play, 
    FastForward, 
    Search, 
    Wand2, 
    ChevronsLeft, 
    ChevronsRight, 
    PackageSearch, 
    TrendingUp,
    ExternalLink
  });
} catch (error) {
  console.error('❌ Lucide icons error:', error);
}

// Teste 4: Imports de hooks e utils
try {
  const { useToast } = require('@/hooks/use-toast');
  console.log('✅ useToast:', useToast);
} catch (error) {
  console.error('❌ useToast error:', error);
}

try {
  const { Progress } = require('@/components/ui/progress');
  console.log('✅ Progress:', Progress);
} catch (error) {
  console.error('❌ Progress error:', error);
}

try {
  const { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } = require('@/components/ui/table');
  console.log('✅ Table components:', { Table, TableBody, TableCell, TableHead, TableHeader, TableRow });
} catch (error) {
  console.error('❌ Table components error:', error);
}

try {
  const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = require('@/components/ui/select');
  console.log('✅ Select components:', { Select, SelectContent, SelectItem, SelectTrigger, SelectValue });
} catch (error) {
  console.error('❌ Select components error:', error);
}

try {
  const { Badge } = require('@/components/ui/badge');
  console.log('✅ Badge:', Badge);
} catch (error) {
  console.error('❌ Badge error:', error);
}

try {
  const { Accordion, AccordionContent, AccordionItem, AccordionTrigger } = require('@/components/ui/accordion');
  console.log('✅ Accordion components:', { Accordion, AccordionContent, AccordionItem, AccordionTrigger });
} catch (error) {
  console.error('❌ Accordion components error:', error);
}

try {
  const { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } = require('@/components/ui/tooltip');
  console.log('✅ Tooltip components:', { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger });
} catch (error) {
  console.error('❌ Tooltip components error:', error);
}

// Teste 5: Imports customizados
try {
  const { FullIcon, FreteGratisIcon, CorreiosLogo, MercadoEnviosIcon } = require('@/components/icons');
  console.log('✅ Custom icons:', { FullIcon, FreteGratisIcon, CorreiosLogo, MercadoEnviosIcon });
} catch (error) {
  console.error('❌ Custom icons error:', error);
}

// Teste 6: Actions
try {
  const { analyzeCatalogAction, findTrendingProductsAction, searchMercadoLivreAction } = require('@/app/actions');
  console.log('✅ Actions:', { analyzeCatalogAction, findTrendingProductsAction, searchMercadoLivreAction });
} catch (error) {
  console.error('❌ Actions error:', error);
}

// Teste 7: Utils e libs
try {
  const { setupPdfjsWorker } = require("@/lib/pdfjs-worker");
  console.log('✅ setupPdfjsWorker:', setupPdfjsWorker);
} catch (error) {
  console.error('❌ setupPdfjsWorker error:', error);
}

try {
  const { buildSearchQuery } = require("@/lib/search-query");
  console.log('✅ buildSearchQuery:', buildSearchQuery);
} catch (error) {
  console.error('❌ buildSearchQuery error:', error);
}

// Teste 8: SearchResultsDialog
try {
  const { SearchResultsDialog } = require('./search-results-dialog');
  console.log('✅ SearchResultsDialog (named):', SearchResultsDialog);
} catch (error) {
  console.error('❌ SearchResultsDialog (named) error:', error);
}

try {
  const SearchResultsDialogDefault = require('./search-results-dialog').default;
  console.log('✅ SearchResultsDialog (default):', SearchResultsDialogDefault);
} catch (error) {
  console.error('❌ SearchResultsDialog (default) error:', error);
}

// Teste 9: PDFjs
try {
  const pdfjs = require('pdfjs-dist');
  console.log('✅ pdfjs:', pdfjs);
} catch (error) {
  console.error('❌ pdfjs error:', error);
}

// Teste 10: Next.js components
try {
  const Image = require('next/image').default;
  const Link = require('next/link').default;
  console.log('✅ Next.js components:', { Image, Link });
} catch (error) {
  console.error('❌ Next.js components error:', error);
}

export default function DebugPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
      <p className="text-muted-foreground">
        Verifique o console do navegador para ver quais imports estão causando erro.
      </p>
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <p className="text-sm">
          Abra o DevTools (F12) e vá para a aba Console para ver os resultados dos testes.
        </p>
      </div>
    </div>
  );
}
