import 'package:flutter/material.dart';

/// Credits the sources the app is built from. Tanzil's license (CC BY 3.0)
/// requires the attribution; the rest is owed as a matter of course.
void showCredits(BuildContext context) {
  final body = Theme.of(context).textTheme.bodyMedium;
  Widget item(String title, String detail) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: body?.copyWith(fontWeight: FontWeight.w600)),
          Text(detail, style: body),
        ]),
      );
  showAboutDialog(
    context: context,
    applicationName: 'القرآن الكريم',
    applicationVersion: 'نسخة تجريبية',
    children: [
      const SizedBox(height: 8),
      item('نص القرآن الكريم', 'مشروع تنزيل (tanzil.net)، برخصة المشاع الإبداعي CC BY 3.0، دون تعديل على النص.'),
      item('بيانات الكلمات والتوقيت وخطوط المصحف', 'مؤسسة القرآن (Quran Foundation) ومجمع الملك فهد لطباعة المصحف الشريف.'),
      item('جذور الكلمات', 'مكتبة QUL (qul.tarteel.ai).'),
      item('الترجمة الإنجليزية', 'علي قلي قرائي (Ali Quli Qara\'i)، عبر تنزيل.'),
      item('خط العرض', 'Amiri Quran، برخصة SIL Open Font License 1.1.'),
    ],
  );
}
