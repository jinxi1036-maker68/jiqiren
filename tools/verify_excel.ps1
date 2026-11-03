param([string]$Root = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
$out=Join-Path $Root 'deliverables/2026-10-15'
$file=Join-Path $out '平顶山三场景_线下采购清单_21项实物图片版.xlsx'
$offline=Join-Path ([System.IO.Path]::GetTempPath()) ('procurement_excel_offline_'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $offline | Out-Null
$copy=Join-Path $offline 'procurement.xlsx'
Copy-Item -LiteralPath $file -Destination $copy
$mapping=Get-Content -LiteralPath (Join-Path $out 'row_mapping.json') -Raw | ConvertFrom-Json
$excel=$null
$book=$null
try {
 $excel=New-Object -ComObject Excel.Application
 $excel.Visible=$false
 $excel.DisplayAlerts=$false
 $excel.AskToUpdateLinks=$false
 $excel.AutomationSecurity=3
 $book=$excel.Workbooks.Open($copy,0,$true)
 $excel.CalculateFull()
 $report=[ordered]@{engine='Microsoft Excel';version=$excel.Version;read_only=$book.ReadOnly;isolated_directory=$true;updates_disabled=$true;native_shape_checks=@();pdf_exports=@();budget_low=$null;budget_high=$null}
 foreach($sheetName in @('完整采购表','看图采购')) {
  $sheet=$book.Worksheets.Item($sheetName)
  if($sheet.Shapes.Count -ne 21){throw "$sheetName native picture count $($sheet.Shapes.Count)"}
  $seen=@()
  foreach($shape in $sheet.Shapes) {
   $row=$shape.TopLeftCell.Row
   $col=$shape.TopLeftCell.Column
   $item=if($sheetName -eq '完整采购表'){$mapping | Where-Object {$_.mainRow -eq $row}}else{$mapping | Where-Object {$_.shopRow -eq $row}}
   if($null -eq $item){throw "$sheetName unexpected picture row $row"}
   $expectedCol=if($sheetName -eq '完整采购表'){5}else{2}
   if($col -ne $expectedCol){throw "$sheetName picture $($item.id) wrong column $col"}
   if($shape.BottomRightCell.Row -ne $row){throw "$sheetName picture $($item.id) spills into another row"}
   if($shape.Type -ne 13){throw "$sheetName shape is not an embedded picture"}
   $seen += [int]$item.id
   $report.native_shape_checks += @{sheet=$sheetName;id=[int]$item.id;row=$row;column=$col;width_pt=[double]$shape.Width;height_pt=[double]$shape.Height;embedded=$true}
  }
  if(($seen | Sort-Object -Unique).Count -ne 21){throw 'Native picture IDs are incomplete'}
  $page=$sheet.PageSetup
  $page.Orientation=2
  $page.PaperSize=8
  $page.Zoom=$false
  $page.FitToPagesWide=1
  $page.FitToPagesTall=$false
  $page.LeftMargin=15
  $page.RightMargin=15
  $page.TopMargin=15
  $page.BottomMargin=15
  $page.PrintGridlines=$false
  $page.PrintHeadings=$false
  if($sheetName -eq '完整采购表'){
   $page.PrintArea='$A$1:$Q$29'
   $page.PrintTitleRows='$7:$7'
  }else{
   $page.PrintArea='$A$1:$F$29'
   $page.PrintTitleRows='$4:$4'
  }
  $pdf=Join-Path $out ($sheetName+'_Excel离线打开预览.pdf')
  $sheet.ExportAsFixedFormat(0,$pdf,0,$true,$false)
  if(-not(Test-Path -LiteralPath $pdf)){throw "PDF export missing $pdf"}
  $report.pdf_exports += @{sheet=$sheetName;file=[System.IO.Path]::GetFileName($pdf);bytes=(Get-Item -LiteralPath $pdf).Length}
 }
 $main=$book.Worksheets.Item('完整采购表')
 $report.budget_low=$main.Range('P29').Value2
 $report.budget_high=$main.Range('Q29').Value2
 if($report.budget_low -ne 502 -or $report.budget_high -ne 1899){throw 'Native recalculated budget differs'}
 $links=$book.LinkSources(1)
 if($null -ne $links){throw 'External workbook links detected'}
 $report.external_workbook_links=0
 $report.connection_count=$book.Connections.Count
 if($report.connection_count -ne 0){throw 'Unexpected external data connection'}
 $report.status='PASS'
 $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out 'excel_native_validation.json') -Encoding utf8
 Write-Output ('PASS: Excel '+$excel.Version+', 42 embedded pictures, 21 correct rows per sheet; native budget 502–1899; PDFs exported.')
} finally {
 if($null -ne $book){$book.Close($false)}
 if($null -ne $excel){$excel.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null}
 # Only remove the exact file we created; preserve the temporary directory for audit.
 if(Test-Path -LiteralPath $copy){Remove-Item -LiteralPath $copy}
}
