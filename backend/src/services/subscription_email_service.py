from __future__ import annotations

from datetime import timezone
from html import escape
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Config
from ..models import User
from .email_service import PRODUCT_UPDATE, TRANSACTIONAL, EmailContent, SesEmailService, first_name_for
from .product_update_email_service import ProductUpdateEmailService


class SubscriptionEmailService:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.email_service = SesEmailService(self.config)

    @property
    def is_configured(self) -> bool:
        return self.email_service.is_configured

    async def send_subscribed_email(self, user: User) -> dict:
        content = self._build_subscribed_email(user)
        return await self.email_service.send_email(user.email, content)

    async def send_unsubscribed_email(self, user: User) -> dict:
        content = self._build_unsubscribed_email(user)
        return await self.email_service.send_email(user.email, content)

    async def send_cancellation_scheduled_email(self, user: User, db: AsyncSession) -> dict:
        content = self._build_cancellation_scheduled_email(user, include_retention_offer=True)
        result = await ProductUpdateEmailService(db, self.config).send_product_update(user.id, content)
        if result.get("skipped"):
            # Confirm the cancellation even when the customer has opted out of
            # promotional emails. The discount belongs only in the optional mail.
            confirmation = self._build_cancellation_scheduled_email(user)
            return await self.email_service.send_email(user.email, confirmation)
        return result

    def _build_cancellation_scheduled_email(
        self, user: User, *, include_retention_offer: bool = False,
    ) -> EmailContent:
        if user.subscription_cancel_at is None:
            raise ValueError("A scheduled cancellation date is required")
        # Promotional mail personalizes names through ProductUpdateEmailService,
        # which escapes HTML and adds the signed unsubscribe link and headers.
        first_name = "{{first_name}}" if include_retention_offer else self._first_name_for(user)
        end_date = user.subscription_cancel_at.astimezone(timezone.utc).strftime(
            "%B %d, %Y at %H:%M UTC"
        )
        paragraphs = [
            "Your GTAClipper cancellation is scheduled. Thanks for giving us a try.",
            "What would have made GTAClipper more useful to you? Just hit reply—a quick note "
            "about what was missing or what got in your way would mean a lot.",
            "If a clip didn't turn out as expected or you got stuck somewhere, tell us "
            "what happened. We'd be happy to take a look.",
        ]
        if include_retention_offer:
            paragraphs.append(
                "If you decide to give GTAClipper another try, we'd love to welcome you back "
                "with 30% off for 3 months. Just reply to this email and we'll get the "
                "discount set up for you."
            )
        closing = (
            f"P.S. Your subscription won't renew, and you'll keep access to your current plan "
            f"until {end_date}. You can undo the cancellation in Settings before then."
        )
        return EmailContent(
            subject="A quick question about your Clippers experience",
            reply_to=("nbms@narang.store",),
            category=PRODUCT_UPDATE if include_retention_offer else TRANSACTIONAL,
            html=(
                f"<p>Hey {escape(first_name)},</p>"
                + "".join(f"<p>{escape(paragraph)}</p>" for paragraph in paragraphs)
                + "<p>Best,<br>Team Clippers</p>"
                + f"<p>{escape(closing)}</p>"
            ),
            text=(
                f"Hey {first_name},\n\n"
                + "\n\n".join(paragraphs)
                + f"\n\nBest,\nTeam GTAClipper\n\n{closing}"
            ),
        )

    def _build_subscribed_email(self, user: User) -> EmailContent:
        first_name = self._first_name_for(user)
        plan_name = "Creator Plan" if user.plan == "scale" else f"{user.plan.capitalize()} Plan"

        end_date_str = ""
        if user.billing_period_end:
            end_date_str = user.billing_period_end.strftime("%d %B, %Y")

        minutes = "1,500 Minutes (25 Hours)" if user.plan == "scale" else "300 Minutes (5 Hours)"
        resolution = "1080p Full HD" if user.plan == "scale" else "720p HD"

        validity_row = f'<tr><td style="padding: 8px 0; color: #94a3b8;">Valid Until:</td><td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">{end_date_str}</td></tr>' if end_date_str else ''

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; color: #f8fafc; border: 1px solid #1e293b;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 32px 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🎉 Welcome to Clippers {plan_name}!</h1>
                <p style="margin: 8px 0 0; color: #f1f5f9; font-size: 15px;">Your membership is now active and ready to create viral clips.</p>
            </div>
            
            <div style="padding: 28px 24px;">
                <p style="font-size: 16px; margin: 0 0 20px; color: #cbd5e1;">Hi <strong>{first_name}</strong>,</p>
                <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px;">
                    Thank you for subscribing to Clippers! Your payment was successful, and your account has been upgraded with all premium creator superpowers.
                </p>
                
                <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155;">
                    <h3 style="margin: 0 0 14px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #38bdf8;">Your Membership Details</h3>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #94a3b8;">Plan Tier:</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">{plan_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #94a3b8;">Status:</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #10b981; text-align: right;">● Active</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #94a3b8;">Video Allowance:</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">{minutes}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #94a3b8;">Output Quality:</td>
                            <td style="padding: 8px 0; font-weight: bold; color: #ffffff; text-align: right;">{resolution}</td>
                        </tr>
                        {validity_row}
                    </table>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://clippers.narang.store" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; display: inline-block;">
                        Start Creating Clips Now →
                    </a>
                </div>

                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 24px 0 0; text-align: center;">
                    If you have any questions or need priority support, reply directly to this email or reach us at <a href="mailto:nbms@narang.store" style="color: #38bdf8;">nbms@narang.store</a>.
                </p>
            </div>
            
            <div style="background: #090d16; padding: 16px; text-align: center; font-size: 12px; color: #475569; border-top: 1px solid #1e293b;">
                © 2026 Clippers. All rights reserved.
            </div>
        </div>
        """

        validity_text = f"Valid Until: {end_date_str}\n" if end_date_str else ""
        text = f"""
Hi {first_name},

Welcome to Clippers {plan_name}!
Your paid membership is now active.

Plan: {plan_name}
Status: Active
Video Allowance: {minutes}
Output Quality: {resolution}
{validity_text}
Start creating viral clips: https://clippers.narang.store

Need help? Contact support at nbms@narang.store

Best,
Team Clippers
        """.strip()

        return EmailContent(
            subject=f"🎉 Welcome to Clippers {plan_name} - Membership Active!",
            html=html,
            text=text,
        )

    def _build_unsubscribed_email(self, user: User) -> EmailContent:
        first_name = self._first_name_for(user)
        return EmailContent(
            subject="Sorry to see you go from GTAClipper",
            html=(
                f"<p>Hi {first_name},</p>"
                "<p>Sorry to see you go, and thanks for trying GTAClipper.</p>"
                "<p>Your subscription has been canceled. If you ever want to come back, we’d love to have you.</p>"
                "<p>Team GTAClipper</p>"
            ),
            text=(
                f"Hi {first_name},\n\n"
                "Sorry to see you go, and thanks for trying GTAClipper.\n\n"
                "Your subscription has been canceled. If you ever want to come back, we’d love to have you.\n\n"
                "Team GTAClipper"
            ),
        )

    @staticmethod
    def _first_name_for(user: User) -> str:
        return first_name_for(first_name=user.first_name, full_name=user.name)
